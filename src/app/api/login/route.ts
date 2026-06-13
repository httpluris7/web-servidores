import { NextResponse } from "next/server";
import { clean } from "@/lib/leads";
import { emailRe } from "@/lib/password";
import { burnPasswordTime, findUserByEmail, verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = clean(body.email, 200);
  const password = typeof body.password === "string" ? body.password : "";

  const errors: Record<string, string> = {};
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";
  if (!password) errors.password = "Enter your password.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // Anti-fuerza bruta: limitamos por IP+email (8 intentos / 5 min). La clave por
  // email evita que, tras un proxy sin IP fiable, un bucket compartido bloquee a
  // todos a la vez.
  const limit = rateLimit(`login:${clientIp(req)}:${email.toLowerCase()}`, {
    limit: 8,
    windowMs: 5 * 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  // Mensaje genérico: no revelamos si el fallo es por email o por contraseña.
  const user = await findUserByEmail(email);
  if (!user) {
    // Igualamos el coste de cómputo (scrypt) para que el tiempo de respuesta no
    // delate si el email existe.
    burnPasswordTime(password);
    return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
  }

  await createSession({ id: user.id, email: user.email });

  return NextResponse.json({ ok: true });
}
