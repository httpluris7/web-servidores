import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { clean } from "@/lib/leads";
import { emailRe, isPasswordValid, isPhoneValid } from "@/lib/password";
import { burnPasswordTime, createUser, findUserByEmail } from "@/lib/auth";
import { createVerifyToken } from "@/lib/verify-tokens";
import { esEmailReservado } from "@/lib/email-reservado";
import { sendRegistrationAttemptMail, sendVerifyEmailMail } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { localizedUrl } from "@/lib/payments/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alta de cliente.
 *
 * vuln-0006 — La cuenta nace PENDIENTE: no se abre sesión. Se envía al correo
 * un enlace de verificación (token de un solo uso, 24 h, guardado como hash) y
 * hasta que el dueño del buzón lo abre la cuenta no puede entrar, pedir ni
 * abrir tickets (lo impone `getSession`). Los buzones del propio dominio
 * (admin@, soporte@, billing@viahost.top…) no se pueden registrar.
 *
 * vuln-0009 — La respuesta es SIEMPRE la misma (200, "revisa tu correo"), exista
 * o no ya una cuenta con ese email, y el tiempo de cómputo se equipara (scrypt
 * en ambos casos; el correo se envía sin esperar). Si el email ya está
 * registrado, el único que se entera es su titular: recibe un aviso de que
 * alguien ha intentado registrarse con su dirección.
 */
export async function POST(req: Request) {
  // Anti-abuso por IP: como máximo 5 altas por IP cada 10 minutos.
  const ip = clientIp(req);
  const byIp = rateLimit(`registro:${ip}`, { limit: 5, windowMs: 10 * 60_000 });
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

  const nombre = clean(body.nombre, 80);
  const apellidos = clean(body.apellidos, 120);
  const direccion = clean(body.direccion, 200);
  const ciudad = clean(body.ciudad, 80);
  const estado = clean(body.estado, 80);
  const pais = clean(body.pais, 80);
  const telefono = clean(body.telefono, 30);
  const codigoPostal = clean(body.codigoPostal, 16);
  const email = clean(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const rawLocale = typeof body.locale === "string" ? body.locale : "";
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  const errors: Record<string, string> = {};
  if (nombre.length < 2) errors.nombre = "Enter your name.";
  if (apellidos.length < 2) errors.apellidos = "Enter your last name.";
  if (direccion.length < 3) errors.direccion = "Enter your address.";
  if (ciudad.length < 2) errors.ciudad = "Enter your city.";
  if (estado.length < 2) errors.estado = "Enter your state.";
  if (pais.length < 2) errors.pais = "Enter your country.";
  if (!isPhoneValid(telefono)) errors.telefono = "Enter a valid phone number.";
  if (codigoPostal.length < 3) errors.codigoPostal = "Enter your postal code.";
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";
  // Buzones del dominio propio: nunca. Es una regla de validación pública (no
  // depende de si existe la cuenta), así que no revela nada.
  else if (esEmailReservado(email)) errors.email = "reserved";
  if (!isPasswordValid(password)) {
    errors.password =
      "The password must be at least 8 characters long, with an uppercase letter, a number and a special symbol.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // Tope por email: aunque rote de IP, nadie inunda un buzón ajeno con
  // enlaces de activación ni avisos. Pasado el tope, se responde igual pero no
  // se envía nada ni se crea nada.
  const byEmail = rateLimit(`registro-mail:${email}`, { limit: 3, windowMs: 60 * 60_000 });
  const generica = NextResponse.json({ ok: true, pending: true });
  if (!byEmail.ok) {
    burnPasswordTime(password);
    return generica;
  }

  const t = await getTranslations({ locale, namespace: "auth" });

  const existente = await findUserByEmail(email);
  if (existente) {
    // Mismo coste que un alta real (scrypt) para no delatar por tiempo.
    burnPasswordTime(password);
    // Aviso al titular. Sin `await`: el envío no debe cambiar el tiempo de
    // respuesta ni el resultado.
    void sendRegistrationAttemptMail({
      to: existente.email,
      name: existente.nombre || existente.email,
      text: {
        subject: t("registrationAttemptMail.subject"),
        greeting: t("registrationAttemptMail.greeting"),
        body: t("registrationAttemptMail.body"),
        hint: t("registrationAttemptMail.hint"),
      },
    }).catch((err) => console.error("[registro] no se pudo avisar al titular de", email, err));
    return generica;
  }

  let user;
  try {
    user = await createUser({
      nombre,
      apellidos,
      direccion,
      ciudad,
      estado,
      pais,
      telefono,
      codigoPostal,
      email,
      password,
      emailVerified: false,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      // Carrera entre dos altas simultáneas: mismo trato que arriba.
      return generica;
    }
    console.error("[registro] no se pudo crear la cuenta de", email, err);
    return NextResponse.json(
      { ok: false, error: "The account could not be created. Please try again." },
      { status: 500 }
    );
  }

  // Enlace de activación. El token en claro solo viaja en el correo.
  try {
    const { token } = await createVerifyToken({ id: user.id, email: user.email });
    const url = `${localizedUrl("/verificar", locale)}?token=${encodeURIComponent(token)}`;
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
    }).catch((err) => console.error("[registro] no se pudo enviar la verificación a", user.email, err));
  } catch (err) {
    console.error("[registro] no se pudo emitir el token de verificación de", user.email, err);
  }

  // Sin sesión: la cuenta está pendiente hasta verificar el correo.
  return generica;
}
