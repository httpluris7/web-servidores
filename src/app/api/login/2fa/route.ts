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

  // 6 dígitos = 1e6 combinaciones: sin estos límites el código se adivina.
  //  - por usuario+IP (6 / 5 min): el caso normal de teclear mal.
  //  - por usuario (15 / 15 min): rotar de IP no multiplica los intentos.
  //  - por IP (30 / 15 min): una máquina no prueba contra muchas cuentas.
  // Superar cualquiera bloquea temporalmente (hasta que vence la ventana).
  // Los códigos TOTP ya son de un solo uso (anti-replay por paso) y la
  // comparación es en tiempo constante (ver lib/mfa.ts y lib/totp.ts).
  const ip = clientIp(req);
  const limits = [
    rateLimit(`mfa:${reto.uid}:${ip}`, { limit: 6, windowMs: 5 * 60_000 }),
    rateLimit(`mfa-user:${reto.uid}`, { limit: 15, windowMs: 15 * 60_000 }),
    rateLimit(`mfa-ip:${ip}`, { limit: 30, windowMs: 15 * 60_000 }),
  ];
  const bloqueado = limits.find((l) => !l.ok);
  if (bloqueado) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(bloqueado.retryAfter) } }
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
