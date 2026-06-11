import { NextResponse } from "next/server";
import { clean } from "@/lib/leads";
import { emailRe, isPasswordValid, isPhoneValid } from "@/lib/password";
import { createUser } from "@/lib/auth";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const nombre = clean(body.nombre, 80);
  const apellidos = clean(body.apellidos, 120);
  const direccion = clean(body.direccion, 200);
  const ciudad = clean(body.ciudad, 80);
  const pais = clean(body.pais, 80);
  const telefono = clean(body.telefono, 30);
  const codigoPostal = clean(body.codigoPostal, 16);
  const email = clean(body.email, 200);
  const password = typeof body.password === "string" ? body.password : "";

  const errors: Record<string, string> = {};
  if (nombre.length < 2) errors.nombre = "Indica tu nombre.";
  if (apellidos.length < 2) errors.apellidos = "Indica tus apellidos.";
  if (direccion.length < 3) errors.direccion = "Indica tu dirección.";
  if (ciudad.length < 2) errors.ciudad = "Indica tu ciudad.";
  if (pais.length < 2) errors.pais = "Indica tu país.";
  if (!isPhoneValid(telefono)) errors.telefono = "Introduce un número de teléfono válido.";
  if (codigoPostal.length < 3) errors.codigoPostal = "Indica tu código postal.";
  if (!emailRe.test(email)) errors.email = "Introduce un email válido.";
  if (!isPasswordValid(password)) {
    errors.password =
      "La contraseña debe tener mínimo 8 caracteres, con una mayúscula, un número y un símbolo especial.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  let user;
  try {
    user = await createUser({
      nombre,
      apellidos,
      direccion,
      ciudad,
      pais,
      telefono,
      codigoPostal,
      email,
      password,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return NextResponse.json(
        { ok: false, errors: { email: "Ya existe una cuenta con este email." } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo crear la cuenta. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  // Auto-login tras registrarse.
  await createSession({ id: user.id, email: user.email });

  return NextResponse.json({ ok: true, user });
}
