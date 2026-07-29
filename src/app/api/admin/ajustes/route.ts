import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import {
  maskSecret,
  readSettings,
  stripeMode,
  tokenExpiresAt,
  updateProviderSettings,
  updateStripeSettings,
  WEBHOOK_EVENTS,
  WEBHOOK_URL,
  type Settings,
} from "@/lib/ajustes";
import { retrieveAccount, StripeError } from "@/lib/payments/stripe";
import { invalidateInventoryCache } from "@/lib/servidores/inventario";
import { ProviderError, verifyToken } from "@/lib/servidores/v4vm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vista pública de los ajustes: NUNCA salen los secretos en claro, solo su
 * versión enmascarada y si están puestos o no.
 */
function publicView(settings: Settings) {
  const { stripe, provider } = settings;
  return {
    stripe: {
      enabled: stripe.enabled,
      hasSecretKey: !!stripe.secretKey,
      secretKeyMask: maskSecret(stripe.secretKey),
      hasWebhookSecret: !!stripe.webhookSecret,
      webhookSecretMask: maskSecret(stripe.webhookSecret),
      mode: stripeMode(stripe.secretKey),
    },
    provider: {
      enabled: provider.enabled,
      apiUrl: provider.apiUrl,
      hasToken: !!provider.token,
      tokenMask: maskSecret(provider.token),
      // Un token con caducidad es casi siempre el de sesión (15 min) en lugar
      // del de API: la pantalla lo avisa en vez de dejarlo fallar solo.
      tokenExpiresAt: provider.token ? (tokenExpiresAt(provider.token)?.toISOString() ?? null) : null,
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

/** Guarda las credenciales del proveedor de servidores. */
async function putProvider(body: Record<string, unknown>) {
  const token = body.token === null ? null : typeof body.token === "string" ? body.token.trim() : undefined;

  if (typeof token === "string" && token && token.length < 20) {
    return NextResponse.json({ ok: false, error: "The API token looks too short." }, { status: 422 });
  }

  // La URL se valida de verdad: un fallo aquí manda el token a otro servidor.
  let apiUrl: string | undefined;
  if (typeof body.apiUrl === "string" && body.apiUrl.trim()) {
    const raw = body.apiUrl.trim();
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "The API URL is not valid." }, { status: 422 });
    }
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ ok: false, error: "The API URL must use https." }, { status: 422 });
    }
    apiUrl = raw;
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  const settings = await updateProviderSettings({ enabled, apiUrl, token });

  // Cambiar el token invalida lo que hubiera cacheado del token anterior.
  invalidateInventoryCache();

  const warning =
    settings.provider.enabled && !settings.provider.token
      ? "The provider is enabled but there is no API token yet."
      : null;

  return NextResponse.json({ ok: true, warning, ...publicView(settings) });
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

  if (body.section === "provider") return putProvider(body);

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

/**
 * Prueba las credenciales guardadas. Por defecto las de Stripe; con
 * `?target=provider`, las del proveedor de servidores.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  if (new URL(req.url).searchParams.get("target") === "provider") {
    const { provider } = await readSettings();
    if (!provider.token) {
      return NextResponse.json({ ok: false, error: "No API token saved yet." }, { status: 422 });
    }
    try {
      const account = await verifyToken({ apiUrl: provider.apiUrl, token: provider.token });
      return NextResponse.json({ ok: true, account });
    } catch (err) {
      const message =
        err instanceof ProviderError ? err.message : "Could not reach the provider.";
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
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
