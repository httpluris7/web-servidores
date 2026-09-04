import { NextResponse } from "next/server";
import { findUserByEmail, verifyPassword } from "@/lib/auth";
import { createSession, getSession } from "@/lib/session";
import { confirmarAltaMfa, desactivarMfa, estadoMfa, iniciarAltaMfa, verificarCodigoMfa } from "@/lib/mfa";
import { qrSvg } from "@/lib/qr";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gestión del 2FA del propio usuario (panel /cuenta).
 *   GET                       → estado
 *   POST {op:"start", password}          → secreto + URI + QR (alta pendiente)
 *   POST {op:"confirm", code}            → activa y devuelve códigos de recuperación
 *   POST {op:"disable", password, code}  → desactiva (contraseña + código vigente)
 * Activar y desactivar exigen la contraseña actual: una sesión abierta en un
 * equipo ajeno no debe poder tocar el segundo factor.
 */

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await estadoMfa(session.uid)) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

  const limit = rateLimit(`mfa-manage:${session.uid}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const op = body.op;
  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

  if (op === "start") {
    if (!password || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ ok: false, errors: { password: "password" } }, { status: 422 });
    }
    const { secret, uri } = await iniciarAltaMfa(user.id, user.email);
    return NextResponse.json({ ok: true, secret, uri, qr: qrSvg(uri) });
  }

  if (op === "confirm") {
    const r = await confirmarAltaMfa(user.id, code);
    if (!r.ok) return NextResponse.json({ ok: false, errors: { code: r.error } }, { status: 422 });
    // La sesión actual pasa a "con código superado": si no, el invariante de
    // getSession la invalidaría en la siguiente petición (2FA activo + mfa=false).
    await createSession({ id: user.id, email: user.email }, { mfa: true });
    return NextResponse.json({ ok: true, recoveryCodes: r.recoveryCodes });
  }

  if (op === "disable") {
    if (!password || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ ok: false, errors: { password: "password" } }, { status: 422 });
    }
    if (!(await verificarCodigoMfa(user.id, code))) {
      return NextResponse.json({ ok: false, errors: { code: "codigo" } }, { status: 422 });
    }
    await desactivarMfa(user.id);
    await createSession({ id: user.id, email: user.email }, { mfa: false });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown op." }, { status: 400 });
}
