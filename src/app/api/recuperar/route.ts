import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { emailRe } from "@/lib/password";
import { burnPasswordTime, findUserByEmail } from "@/lib/auth";
import { createResetToken } from "@/lib/reset-tokens";
import { sendPasswordResetMail } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { localizedUrl } from "@/lib/payments/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Solicitud de enlace para restablecer la contraseña.
 *
 * Norma principal: la respuesta es SIEMPRE la misma exista o no la cuenta. Si
 * distinguiéramos, este endpoint sería un comprobador de qué correos están
 * registrados. Por eso tampoco devuelve errores distintos ni tarda distinto: si
 * el email no existe se quema el mismo tiempo de cómputo que costaría el caso
 * real (`burnPasswordTime`).
 */
export async function POST(req: Request) {
  // Dos topes: por IP (quien barre correos) y por email (quien acosa a una
  // cuenta concreta a base de correos de recuperación).
  const ip = clientIp(req);
  const byIp = rateLimit(`reset-req-ip:${ip}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!byIp.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(byIp.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase().slice(0, 200);
  const rawLocale = typeof body.locale === "string" ? body.locale : "";
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  if (!emailRe.test(email)) {
    return NextResponse.json(
      { ok: false, errors: { email: "Enter a valid email." } },
      { status: 422 }
    );
  }

  // Tope por cuenta: aunque cambie de IP, no puede inundar un buzón ajeno.
  const byEmail = rateLimit(`reset-req-mail:${email}`, { limit: 3, windowMs: 60 * 60_000 });

  const user = await findUserByEmail(email);

  if (user && byEmail.ok) {
    try {
      const { token } = await createResetToken({ id: user.id, email: user.email });
      const url = `${localizedUrl("/restablecer", locale)}?token=${encodeURIComponent(token)}`;
      const t = await getTranslations({ locale, namespace: "auth" });

      await sendPasswordResetMail({
        to: user.email,
        name: user.nombre || user.email,
        url,
        text: {
          subject: t("resetMail.subject"),
          greeting: t("resetMail.greeting"),
          intro: t("resetMail.intro"),
          linkLabel: t("resetMail.linkLabel"),
          expiry: t("resetMail.expiry"),
          ignore: t("resetMail.ignore"),
        },
      });
    } catch (err) {
      // Un fallo de envío no puede revelar que la cuenta existe: se registra y
      // se responde igual que en el resto de casos.
      console.error("[auth] no se pudo enviar el enlace de recuperación:", err);
    }
  } else if (!user) {
    // Equipara el coste: sin esto, el tiempo de respuesta delata qué correos
    // están registrados.
    burnPasswordTime("timing-equalizer");
  }

  return NextResponse.json({ ok: true });
}
