import { NextResponse } from "next/server";
import { createSession, destroyMfaChallenge, getMfaChallenge } from "@/lib/session";
import { verificarCodigoMfa } from "@/lib/mfa";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Segundo paso del login: el reto (`vh_mfa`) identifica al usuario que ya
 * acertó la contraseña; aquí se comprueba el código TOTP o uno de recuperación
 * y, si vale, se emite la sesión real con `mfa: true`.
 */
export async function POST(req: Request) {
  const reto = await getMfaChallenge();
  if (!reto) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });
  }

  // 6 dígitos = 1e6 combinaciones: sin este límite el código se adivina.
  const limit = rateLimit(`mfa:${reto.uid}:${clientIp(req)}`, { limit: 6, windowMs: 5 * 60_000 });
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
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length > 20) {
    return NextResponse.json({ ok: false, error: "code" }, { status: 422 });
  }

  const tipo = await verificarCodigoMfa(reto.uid, code);
  if (!tipo) {
    return NextResponse.json({ ok: false, error: "code" }, { status: 401 });
  }

  await createSession({ id: reto.uid, email: reto.email }, { mfa: true });
  await destroyMfaChallenge();
  return NextResponse.json({ ok: true, via: tipo });
}
