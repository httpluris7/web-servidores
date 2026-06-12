import { NextResponse } from "next/server";
import { isPasswordValid } from "@/lib/password";
import { getPublicUserById, updateUserPassword } from "@/lib/auth";
import { getAdminSession } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restablecimiento de contraseña de un cliente por parte de un administrador.
 * No requiere la contraseña anterior (es un reset administrativo), pero sí el
 * guard de admin y la nueva contraseña repetida dos veces.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  const errors: Record<string, string> = {};
  if (!isPasswordValid(password)) {
    errors.password =
      "La contraseña debe tener mínimo 8 caracteres, con una mayúscula, un número y un símbolo especial.";
  }
  if (passwordConfirm !== password) errors.passwordConfirm = "Las contraseñas no coinciden.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const cliente = await getPublicUserById(id);
  if (!cliente) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado." }, { status: 404 });
  }

  const updated = await updateUserPassword(id, password);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "No se pudo actualizar la contraseña. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
