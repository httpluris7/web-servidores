import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { updateUserEmail } from "@/lib/auth";
import { consumeEmailChangeToken } from "@/lib/email-change-tokens";
import { linkInvoicesToUser } from "@/lib/facturas";
import { sendEmailChangeNoticeMail } from "@/lib/mail";
import { createSession, getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paso 2 del cambio de email: canjea el token del enlace. Exige sesión y que
 * la sesión sea del mismo usuario que pidió el cambio: el enlace solo, sin
 * estar dentro de la cuenta, no basta. Al cambiar, se re-emite la cookie de
 * este dispositivo con el email nuevo; el resto de sesiones caducan solas.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const limit = rateLimit(`email-confirm:${session.uid}`, { limit: 10, windowMs: 10 * 60_000 });
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
  const rawLocale = typeof body.locale === "string" ? body.locale : "";
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  const consumed = await consumeEmailChangeToken(token);
  if (!consumed.ok) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }
  if (consumed.userId !== session.uid) {
    // El token era de otra cuenta: ya está consumido y no vale para nada.
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  const oldEmail = session.email;
  let user;
  try {
    user = await updateUserEmail(session.uid, consumed.newEmail);
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return NextResponse.json({ ok: false, error: "email_taken" }, { status: 409 });
    }
    throw err;
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  // Facturas manuales que solo se relacionaban con él por el email antiguo.
  await linkInvoicesToUser(user.id, oldEmail).catch((err) => {
    console.error("[auth] no se pudieron vincular facturas tras el cambio de email:", err);
  });

  // Este dispositivo sigue dentro; los demás tendrán que volver a entrar.
  await createSession({ id: user.id, email: user.email }, { mfa: session.mfa === true });

  // Aviso de seguridad al buzón antiguo. Best-effort: no bloquea el cambio.
  try {
    const t = await getTranslations({ locale, namespace: "auth" });
    await sendEmailChangeNoticeMail({
      to: oldEmail,
      name: user.nombre || oldEmail,
      text: {
        subject: t("emailChangedNotice.subject"),
        greeting: t("emailChangedNotice.greeting"),
        body: t("emailChangedNotice.body", { email: user.email }),
        warning: t("emailChangedNotice.warning"),
      },
    });
  } catch (err) {
    console.error("[auth] no se pudo avisar al email antiguo del cambio:", err);
  }

  return NextResponse.json({ ok: true, email: user.email });
}
