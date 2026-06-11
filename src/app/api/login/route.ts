import { NextResponse } from "next/server";
import { clean } from "@/lib/leads";
import { emailRe } from "@/lib/password";
import { findUserByEmail, verifyPassword } from "@/lib/auth";
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

  const email = clean(body.email, 200);
  const password = typeof body.password === "string" ? body.password : "";

  const errors: Record<string, string> = {};
  if (!emailRe.test(email)) errors.email = "Introduce un email válido.";
  if (!password) errors.password = "Introduce tu contraseña.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // Mensaje genérico: no revelamos si el fallo es por email o por contraseña.
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, error: "Email o contraseña incorrectos." },
      { status: 401 }
    );
  }

  await createSession({ id: user.id, email: user.email });

  return NextResponse.json({ ok: true });
}
