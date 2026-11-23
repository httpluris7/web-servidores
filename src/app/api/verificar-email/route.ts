import { NextResponse } from "next/server";
import { markEmailVerified } from "@/lib/auth";
import { consumeVerifyToken } from "@/lib/verify-tokens";
import { createSession } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Canje del enlace de activación (vuln-0006). El token se consume y la cuenta
 * pasa a verificada en la misma operación; después se abre sesión en este
 * navegador (quien pulsa acaba de demostrar que el buzón es suyo). El token es
 * de un solo uso: un segundo clic no sirve.
 */
export async function POST(req: Request) {
  // Son 32 bytes aleatorios, pero el tope evita probar en volumen.
  const limit = rateLimit(`verify-email:${clientIp(req)}`, { limit: 10, windowMs: 15 * 60_000 });
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
  const token = typeof body.token === "string" ? body.token : "";

  const consumed = await consumeVerifyToken(token);
  if (!consumed.ok) {
    return NextResponse.json({ ok: false, error: "invalid_token", reason: consumed.reason }, { status: 400 });
  }

  const user = await markEmailVerified(consumed.userId);
  if (!user || user.email.toLowerCase() !== consumed.email) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  await createSession({ id: user.id, email: user.email });
  console.log("[auth] email verificado para", user.email);
  return NextResponse.json({ ok: true });
}
