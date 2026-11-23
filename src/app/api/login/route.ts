import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { clean } from "@/lib/leads";
import { emailRe } from "@/lib/password";
import { burnPasswordTime, findUserByEmail, isEmailVerified, verifyPassword } from "@/lib/auth";
import { createMfaChallenge, createSession } from "@/lib/session";
import { isMfaEnabled } from "@/lib/mfa";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createVerifyToken } from "@/lib/verify-tokens";
import { sendVerifyEmailMail } from "@/lib/mail";
import { localizedUrl } from "@/lib/payments/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = clean(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const rawLocale = typeof body.locale === "string" ? body.locale : "";
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  const errors: Record<string, string> = {};
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";
  if (!password) errors.password = "Enter your password.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // Anti-fuerza bruta en tres capas (vuln-0009):
  //  - IP+email (8 / 5 min): el caso normal de equivocarse de contraseña.
  //  - IP sola (40 / 15 min): quien barre muchos emails desde una máquina.
  //  - email solo (20 / 15 min): quien ataca UNA cuenta rotando de IP. Más
  //    holgado que el anterior para que un atacante no pueda dejar fuera al
  //    titular con cuatro intentos, pero suficiente para frenar el diccionario.
  const ip = clientIp(req);
  const limits = [
    rateLimit(`login:${ip}:${email}`, { limit: 8, windowMs: 5 * 60_000 }),
    rateLimit(`login-ip:${ip}`, { limit: 40, windowMs: 15 * 60_000 }),
    rateLimit(`login-mail:${email}`, { limit: 20, windowMs: 15 * 60_000 }),
  ];
  const bloqueado = limits.find((l) => !l.ok);
  if (bloqueado) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(bloqueado.retryAfter) } }
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

  // Cuenta pendiente de verificar el email (vuln-0006): la contraseña es
  // correcta pero no se abre sesión. Se reenvía el enlace de activación (con
  // tope por cuenta, para no inundar el buzón) y se responde "revisa tu correo".
  if (!isEmailVerified(user)) {
    const reenvio = rateLimit(`verify-resend:${user.id}`, { limit: 3, windowMs: 60 * 60_000 });
    if (reenvio.ok) {
      try {
        const { token } = await createVerifyToken({ id: user.id, email: user.email });
        const url = `${localizedUrl("/verificar", locale)}?token=${encodeURIComponent(token)}`;
        const t = await getTranslations({ locale, namespace: "auth" });
        void sendVerifyEmailMail({
          to: user.email,
          name: user.nombre || user.email,
          url,
          text: {
            subject: t("verifyMail.subject"),
            greeting: t("verifyMail.greeting"),
            intro: t("verifyMail.intro"),
            linkLabel: t("verifyMail.linkLabel"),
            expiry: t("verifyMail.expiry"),
            ignore: t("verifyMail.ignore"),
          },
        }).catch((err) => console.error("[login] no se pudo reenviar la verificación a", user.email, err));
      } catch (err) {
        console.error("[login] no se pudo emitir el token de verificación de", user.email, err);
      }
    }
    return NextResponse.json({ ok: true, pending: true });
  }

  // Con 2FA activo la contraseña no abre sesión: deja un reto de 5 min y el
  // cliente pide el código a /api/login/2fa. Sin 2FA, sesión directa.
  if (await isMfaEnabled(user.id)) {
    await createMfaChallenge({ id: user.id, email: user.email });
    return NextResponse.json({ ok: true, mfa: true });
  }

  await createSession({ id: user.id, email: user.email });

  return NextResponse.json({ ok: true });
}
