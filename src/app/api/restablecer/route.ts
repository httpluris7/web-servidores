import { NextResponse } from "next/server";
import { isPasswordValid } from "@/lib/password";
import { updateUserPassword } from "@/lib/auth";
import { consumeResetToken } from "@/lib/reset-tokens";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fija la nueva contraseña a partir del token del correo.
 *
 * El token se canjea ANTES de tocar la contraseña y queda marcado como usado en
 * la misma operación, así que un enlace sirve una sola vez aunque se pulse dos
 * veces o alguien reenvíe el correo.
 *
 * No se abre sesión al terminar: quien llega aquí puede no ser el dueño de la
 * cuenta (correo comprometido), y en ese caso lo último que queremos es darle
 * una sesión iniciada. El usuario entra después por el formulario de acceso.
 */
export async function POST(req: Request) {
  // Freno a la fuerza bruta de tokens: son 32 bytes aleatorios, pero el límite
  // evita que alguien pruebe en volumen.
  const limit = rateLimit(`reset-set:${clientIp(req)}`, { limit: 10, windowMs: 15 * 60_000 });
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
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  const errors: Record<string, string> = {};
  if (!isPasswordValid(password)) {
    errors.password =
      "The password must be at least 8 characters long, with an uppercase letter, a number and a special symbol.";
  }
  if (passwordConfirm !== password) errors.passwordConfirm = "The passwords do not match.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const consumed = await consumeResetToken(token);
  if (!consumed.ok) {
    return NextResponse.json(
      { ok: false, error: "invalid_token", reason: consumed.reason },
      { status: 400 }
    );
  }

  const updated = await updateUserPassword(consumed.userId, password);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "The password could not be updated. Please try again." },
      { status: 500 }
    );
  }

  // Cambiar la contraseña cambia la huella de autenticación del usuario, así que
  // TODAS las cookies de sesión emitidas antes dejan de valer: si alguien había
  // entrado con la contraseña vieja, queda fuera. Ver `lib/session.ts`.
  console.log("[auth] contraseña restablecida para", consumed.email);
  return NextResponse.json({ ok: true });
}
