import { NextResponse } from "next/server";
import { isPasswordValid } from "@/lib/password";
import { findUserByEmail, updateUserPassword, verifyPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";

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
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  const errors: Record<string, string> = {};
  if (!currentPassword) errors.currentPassword = "Introduce tu contraseña actual.";
  if (!isPasswordValid(password)) {
    errors.password =
      "La contraseña debe tener mínimo 8 caracteres, con una mayúscula, un número y un símbolo especial.";
  }
  if (passwordConfirm !== password) errors.passwordConfirm = "Las contraseñas no coinciden.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // El usuario de la sesión debe seguir existiendo y la contraseña actual encajar.
  const user = await findUserByEmail(session.email);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, errors: { currentPassword: "La contraseña actual no es correcta." } },
      { status: 422 }
    );
  }

  if (verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, errors: { password: "La nueva contraseña debe ser distinta de la actual." } },
      { status: 422 }
    );
  }

  const updated = await updateUserPassword(user.id, password);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "No se pudo actualizar la contraseña. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
