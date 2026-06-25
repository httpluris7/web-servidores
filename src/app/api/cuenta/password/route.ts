import { NextResponse } from "next/server";
import { isPasswordValid } from "@/lib/password";
import { findUserByEmail, updateUserPassword, verifyPassword } from "@/lib/auth";
import { createSession, getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cambio de contraseña del propio usuario autenticado.
 * Requiere la contraseña actual (defensa frente a sesiones abiertas) y la nueva
 * repetida dos veces para evitar errores de tecleo.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  // Anti fuerza-bruta de la contraseña ACTUAL: máx. 5 intentos por usuario / 10 min.
  const limit = rateLimit(`password-change:${session.uid}`, { limit: 5, windowMs: 10 * 60_000 });
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

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  const errors: Record<string, string> = {};
  if (!currentPassword) errors.currentPassword = "Enter your current password.";
  if (!isPasswordValid(password)) {
    errors.password =
      "The password must be at least 8 characters long, with an uppercase letter, a number and a special symbol.";
  }
  if (passwordConfirm !== password) errors.passwordConfirm = "The passwords do not match.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // El usuario de la sesión debe seguir existiendo y la contraseña actual encajar.
  const user = await findUserByEmail(session.email);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, errors: { currentPassword: "The current password is not correct." } },
      { status: 422 }
    );
  }

  if (verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, errors: { password: "The new password must be different from the current one." } },
      { status: 422 }
    );
  }

  const updated = await updateUserPassword(user.id, password);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "The password could not be updated. Please try again." },
      { status: 500 }
    );
  }

  // El cambio invalida toda cookie emitida con la huella anterior (resto de
  // dispositivos). Re-emitimos la del dispositivo actual con la nueva huella
  // para no cerrar la sesión desde la que se hizo el cambio.
  await createSession({ id: user.id, email: user.email });

  return NextResponse.json({ ok: true });
}
