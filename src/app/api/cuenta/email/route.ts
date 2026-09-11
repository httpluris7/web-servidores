import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { emailRe } from "@/lib/password";
import { findUserByEmail, getPublicUserById, verifyPassword } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { createEmailChangeToken } from "@/lib/email-change-tokens";
import { sendEmailChangeMail } from "@/lib/mail";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { localizedUrl } from "@/lib/payments/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paso 1 del cambio de email: el usuario autenticado indica la dirección nueva
 * y su contraseña actual. Se envía un enlace de confirmación a la dirección
 * NUEVA; el email de la cuenta no cambia hasta que se confirme (paso 2, en
 * /api/cuenta/email/confirmar).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  // Anti fuerza-bruta de la contraseña actual: máx. 10 intentos / 10 min.
  const tries = rateLimit(`email-change-try:${session.uid}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!tries.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(tries.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase().slice(0, 200);
  const password = typeof body.password === "string" ? body.password : "";
  const rawLocale = typeof body.locale === "string" ? body.locale : "";
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  const errors: Record<string, string> = {};
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";
  if (!password) errors.password = "Enter your current password.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const current = await findUserByEmail(session.email);
  if (!current || current.id !== session.uid) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  // Los administradores se identifican por email (ADMIN_EMAILS): cambiarlo
  // desde aquí les haría perder el acceso al panel. Se cambia a mano.
  if (isAdminEmail(current.email)) {
    return NextResponse.json({ ok: false, error: "admin_locked" }, { status: 403 });
  }

  if (!verifyPassword(password, current.passwordHash)) {
    return NextResponse.json(
      { ok: false, errors: { password: "The current password is not correct." } },
      { status: 422 }
    );
  }

  if (email === current.email.toLowerCase()) {
    return NextResponse.json(
      { ok: false, errors: { email: "That is already the email of this account." } },
      { status: 422 }
    );
  }

  if (await findUserByEmail(email)) {
    return NextResponse.json(
      { ok: false, errors: { email: "An account with this email already exists." } },
      { status: 409 }
    );
  }

  // Tope de correos enviados (no de intentos): 3 por hora. Se comprueba una
  // vez validado todo, para que un error de tecleo no consuma el cupo.
  const sends = rateLimit(`email-change-send:${session.uid}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!sends.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(sends.retryAfter) } }
    );
  }

  const user = await getPublicUserById(current.id);
  try {
    const { token } = await createEmailChangeToken(current.id, email);
    const url = `${localizedUrl("/cuenta/email", locale)}?token=${encodeURIComponent(token)}`;
    const t = await getTranslations({ locale, namespace: "auth" });
    await sendEmailChangeMail({
      to: email,
      name: user?.nombre || email,
      url,
      text: {
        subject: t("emailChangeMail.subject"),
        greeting: t("emailChangeMail.greeting"),
        intro: t("emailChangeMail.intro", { email: current.email }),
        linkLabel: t("emailChangeMail.linkLabel"),
        expiry: t("emailChangeMail.expiry"),
        ignore: t("emailChangeMail.ignore"),
      },
    });
  } catch (err) {
    console.error("[auth] no se pudo enviar el enlace de cambio de email:", err);
    return NextResponse.json(
      { ok: false, error: "The confirmation email could not be sent. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, email });
}
