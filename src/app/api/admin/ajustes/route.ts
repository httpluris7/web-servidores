import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import {
  maskSecret,
  readSettings,
  stripeMode,
  updateStripeSettings,
  WEBHOOK_EVENTS,
  WEBHOOK_URL,
  type Settings,
} from "@/lib/ajustes";
import { retrieveAccount, StripeError } from "@/lib/payments/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vista pública de los ajustes: NUNCA salen los secretos en claro, solo su
 * versión enmascarada y si están puestos o no.
 */
function publicView(settings: Settings) {
  const { stripe } = settings;
  return {
    stripe: {
      enabled: stripe.enabled,
      hasSecretKey: !!stripe.secretKey,
      secretKeyMask: maskSecret(stripe.secretKey),
      hasWebhookSecret: !!stripe.webhookSecret,
      webhookSecretMask: maskSecret(stripe.webhookSecret),
      mode: stripeMode(stripe.secretKey),
    },
    webhookUrl: WEBHOOK_URL,
    webhookEvents: WEBHOOK_EVENTS,
  };
}

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, ...publicView(await readSettings()) });
}

/** Valida el formato de una clave para no guardar algo que no cobrará nunca. */
function keyError(value: string, prefixes: string[], label: string): string | null {
  if (!value) return null; // vacío = "no la cambies"
  if (!prefixes.some((p) => value.startsWith(p))) {
    return `${label} should start with ${prefixes.join(" or ")}.`;
  }
  if (value.length < 20) return `${label} looks too short.`;
  return null;
}

export async function PUT(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  // `null` borra la clave guardada; ausente o cadena vacía la deja como está.
  const readKey = (v: unknown): string | null | undefined => {
    if (v === null) return null;
    if (typeof v !== "string") return undefined;
    return v.trim();
  };

  const secretKey = readKey(body.secretKey);
  const webhookSecret = readKey(body.webhookSecret);

  // La clave publicable (pk_) es el error de copiar-pegar más habitual; avisar
  // de eso vale más que dejar guardada una clave con la que Stripe dará 401.
  const errors = [
    typeof secretKey === "string"
      ? keyError(secretKey, ["sk_", "rk_"], "The secret key")
      : null,
    typeof webhookSecret === "string"
      ? keyError(webhookSecret, ["whsec_"], "The webhook signing secret")
      : null,
  ].filter(Boolean);

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors[0] }, { status: 422 });
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  const settings = await updateStripeSettings({ enabled, secretKey, webhookSecret });

  // Activar sin clave de API no cobraría nada: lo decimos en claro.
  const warning =
    settings.stripe.enabled && !settings.stripe.secretKey
      ? "Stripe is enabled but there is no API key yet."
      : null;

  return NextResponse.json({ ok: true, warning, ...publicView(settings) });
}

/** Prueba la clave guardada contra Stripe y devuelve de qué cuenta es. */
export async function POST() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  const { stripe } = await readSettings();
  if (!stripe.secretKey) {
    return NextResponse.json({ ok: false, error: "No API key saved yet." }, { status: 422 });
  }

  try {
    const account = await retrieveAccount(stripe.secretKey);
    return NextResponse.json({
      ok: true,
      account,
      mode: stripeMode(stripe.secretKey),
    });
  } catch (err) {
    const message = err instanceof StripeError ? err.message : "Could not reach Stripe.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
