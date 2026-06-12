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
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
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
  if (nombre.length < 2) errors.nombre = "Enter your name.";
  if (apellidos.length < 2) errors.apellidos = "Enter your last name.";
  if (direccion.length < 3) errors.direccion = "Enter your address.";
  if (ciudad.length < 2) errors.ciudad = "Enter your city.";
  if (pais.length < 2) errors.pais = "Enter your country.";
  if (!isPhoneValid(telefono)) errors.telefono = "Enter a valid phone number.";
  if (codigoPostal.length < 3) errors.codigoPostal = "Enter your postal code.";
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";
  if (!isPasswordValid(password)) {
    errors.password =
      "The password must be at least 8 characters long, with an uppercase letter, a number and a special symbol.";
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
        { ok: false, errors: { email: "An account with this email already exists." } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "The account could not be created. Please try again." },
      { status: 500 }
    );
  }

  // Auto-login tras registrarse.
  await createSession({ id: user.id, email: user.email });

  return NextResponse.json({ ok: true, user });
}
