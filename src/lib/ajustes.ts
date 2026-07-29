import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { site } from "@/data/site";

/**
 * Ajustes editables desde el panel (`/admin/configuracion`).
 *
 * Viven en `data/ajustes.json`, fuera de git y con permisos 0600, porque
 * guardan SECRETOS (la clave de API de Stripe permite mover dinero). Reglas:
 *
 *  - Nunca se devuelven en claro fuera del servidor: la API del panel solo
 *    expone la versión enmascarada (`maskSecret`) y un booleano de "ya hay
 *    clave guardada".
 *  - Nunca se registran en logs ni se incluyen en mensajes de error.
 *  - El entorno sigue funcionando como respaldo (`STRIPE_SECRET_KEY`,
 *    `STRIPE_WEBHOOK_SECRET`): si alguien prefiere gestionarlas por `.env`, no
 *    hace falta tocar el panel. El fichero tiene prioridad sobre el entorno.
 *
 * Se lee en cada petición (fichero diminuto) para que un cambio en el panel
 * tenga efecto inmediato, sin reiniciar el proceso.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "ajustes.json");

export type StripeSettings = {
  /** Interruptor: aunque haya claves, sin esto no se cobra por Stripe. */
  enabled: boolean;
  /** Clave secreta de API (sk_test_… / sk_live_…). */
  secretKey: string;
  /** Secreto de firma del endpoint de webhook (whsec_…). */
  webhookSecret: string;
};

/**
 * Proveedor de servidores (hoy v4vm, que expone una API SolusVM 2). El token
 * da control total sobre los VPS —encender, borrar, reinstalar—, así que se
 * trata con el mismo cuidado que la clave de Stripe.
 */
export type ProviderSettings = {
  /** Interruptor: sin esto no se habla con el proveedor aunque haya token. */
  enabled: boolean;
  /** Base de la API, con la versión incluida. */
  apiUrl: string;
  /** Token de API que viaja como `Authorization: Bearer …`. */
  token: string;
};

export type Settings = { stripe: StripeSettings; provider: ProviderSettings };

/** Base de la API del proveedor actual, si no se configura otra. */
export const DEFAULT_PROVIDER_API_URL = "https://manage.v4vm.com/api/v1";

/* --------------------------------- Lectura -------------------------------- */

function fromEnv(): StripeSettings {
  return {
    enabled: false,
    secretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
  };
}

function providerFromEnv(): ProviderSettings {
  return {
    enabled: false,
    apiUrl: (process.env.PROVIDER_API_URL || "").trim() || DEFAULT_PROVIDER_API_URL,
    token: (process.env.PROVIDER_API_TOKEN || "").trim(),
  };
}

function normalizeStripe(raw: unknown, fallback: StripeSettings): StripeSettings {
  const o = (raw ?? {}) as Partial<Record<keyof StripeSettings, unknown>>;
  const secretKey = typeof o.secretKey === "string" ? o.secretKey.trim() : "";
  const webhookSecret = typeof o.webhookSecret === "string" ? o.webhookSecret.trim() : "";
  return {
    // Lo guardado manda; si un campo falta, se hereda del entorno.
    enabled: o.enabled === true,
    secretKey: secretKey || fallback.secretKey,
    webhookSecret: webhookSecret || fallback.webhookSecret,
  };
}

function normalizeProvider(raw: unknown, fallback: ProviderSettings): ProviderSettings {
  const o = (raw ?? {}) as Partial<Record<keyof ProviderSettings, unknown>>;
  const apiUrl = typeof o.apiUrl === "string" ? o.apiUrl.trim() : "";
  const token = typeof o.token === "string" ? o.token.trim() : "";
  return {
    enabled: o.enabled === true,
    apiUrl: apiUrl || fallback.apiUrl,
    token: token || fallback.token,
  };
}

/** Ajustes efectivos (fichero sobre entorno). Nunca lanza: sin fichero, vacíos. */
export async function readSettings(): Promise<Settings> {
  const env = fromEnv();
  const providerEnv = providerFromEnv();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    // Sin fichero (o ilegible/corrupto): nos quedamos con el entorno.
    // Si el entorno trae claves, damos por activo el cobro por Stripe.
    return {
      stripe: { ...env, enabled: !!env.secretKey || !!env.webhookSecret },
      provider: { ...providerEnv, enabled: !!providerEnv.token },
    };
  }
  const obj = (parsed ?? {}) as { stripe?: unknown; provider?: unknown };
  return {
    stripe: normalizeStripe(obj.stripe, env),
    provider: normalizeProvider(obj.provider, providerEnv),
  };
}

/* -------------------------------- Escritura ------------------------------- */

/**
 * Guarda los ajustes. Se escribe con 0600 ANTES de volcar el contenido para que
 * los secretos no lleguen a existir en disco con permisos abiertos.
 */
export async function writeSettings(next: Settings): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, "", { mode: 0o600, flag: "a" });
  await chmod(FILE, 0o600);
  await writeFile(FILE, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
}

/**
 * Resuelve el valor nuevo de un secreto en una actualización parcial: `null`
 * lo borra, `undefined` (o cadena vacía) conserva el que ya había. Los
 * formularios no reciben nunca los secretos, así que no pueden reenviarlos:
 * dejar el campo en blanco tiene que significar "no lo toques".
 */
function pickSecret(value: string | null | undefined, previous: string): string {
  if (value === null) return "";
  if (value === undefined) return previous;
  const trimmed = value.trim();
  return trimmed === "" ? previous : trimmed;
}

/**
 * Aplica cambios parciales de Stripe. Una cadena vacía significa "deja la que
 * ya había"; para borrar una clave se envía `null`.
 */
export async function updateStripeSettings(patch: {
  enabled?: boolean;
  secretKey?: string | null;
  webhookSecret?: string | null;
}): Promise<Settings> {
  const current = await readSettings();
  const next: Settings = {
    ...current,
    stripe: {
      enabled: patch.enabled ?? current.stripe.enabled,
      secretKey: pickSecret(patch.secretKey, current.stripe.secretKey),
      webhookSecret: pickSecret(patch.webhookSecret, current.stripe.webhookSecret),
    },
  };
  await writeSettings(next);
  return next;
}

/** Igual que `updateStripeSettings`, para las credenciales del proveedor. */
export async function updateProviderSettings(patch: {
  enabled?: boolean;
  apiUrl?: string;
  token?: string | null;
}): Promise<Settings> {
  const current = await readSettings();
  const apiUrl = (patch.apiUrl ?? "").trim();
  const next: Settings = {
    ...current,
    provider: {
      enabled: patch.enabled ?? current.provider.enabled,
      apiUrl: apiUrl || current.provider.apiUrl || DEFAULT_PROVIDER_API_URL,
      token: pickSecret(patch.token, current.provider.token),
    },
  };
  await writeSettings(next);
  return next;
}

/* --------------------------------- Ayudas --------------------------------- */

/**
 * Versión mostrable de un secreto: prefijo reconocible + últimos 4 caracteres.
 * Con menos de 12 caracteres no se enseña nada más que puntos: no merece la
 * pena filtrar parte de un secreto corto por comodidad visual.
 *
 * El prefijo se busca SOLO en los 8 primeros caracteres. Antes se cortaba por
 * el último "_" del valor entero, lo que funciona con `sk_live_…` pero deja al
 * descubierto casi todo un JWT —los tokens del proveedor lo son y llevan "_"
 * cerca del final—. El corte va acotado para que ningún formato de secreto
 * futuro pueda ensanchar la parte visible.
 */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length < 12) return "•".repeat(8);
  const start = value.slice(0, 8);
  const cut = start.lastIndexOf("_");
  const head = cut >= 0 ? start.slice(0, cut + 1) : value.slice(0, 3);
  return `${head}${"•".repeat(6)}${value.slice(-4)}`;
}

export type StripeMode = "test" | "live" | "unknown";

/** Modo deducido del prefijo de la clave secreta. */
export function stripeMode(secretKey: string): StripeMode {
  if (secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) return "test";
  if (secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) return "live";
  return "unknown";
}

/** Ruta del endpoint que recibe los webhooks de la pasarela. */
export const WEBHOOK_PATH = "/api/webhooks/payments";

/** URL absoluta del webhook, la que hay que dar de alta en el panel de Stripe. */
export const WEBHOOK_URL = `${site.url}${WEBHOOK_PATH}`;

/**
 * Eventos que necesita la integración. `checkout.session.completed` es el que
 * cierra el cobro; `payment_intent.succeeded` es un respaldo por si la sesión
 * no llega, y es inofensivo: la factura ya pagada no se vuelve a emitir.
 */
export const WEBHOOK_EVENTS = ["checkout.session.completed", "payment_intent.succeeded"];

/** ¿Se puede cobrar por Stripe ahora mismo? (activo y con clave de API) */
export async function stripeIsReady(): Promise<boolean> {
  const { stripe } = await readSettings();
  return stripe.enabled && !!stripe.secretKey;
}

/**
 * Fecha de caducidad de un token del proveedor, o null si no caduca (o no se
 * puede saber).
 *
 * La API del proveedor entrega dos cosas muy distintas con la misma pinta: el
 * token de `/auth/login`, que es de sesión y **dura 15 minutos**, y el de
 * `/account/tokens`, que es el de verdad. Confundirlos deja la integración
 * funcionando un rato y luego "el token es rechazado" sin motivo aparente. Como
 * ambos son JWT, la fecha viene en el propio token: la leemos para avisar en el
 * panel ANTES de que caduque.
 *
 * Solo se decodifica el cuerpo para leer `exp`; no se valida la firma, que no
 * es cosa nuestra: quien la comprueba es el proveedor.
 */
export function tokenExpiresAt(token: string): Date | null {
  const [, body] = token.split(".");
  if (!body || token.split(".").length !== 3) return null; // no es un JWT
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

/** ¿Se puede consultar el proveedor de servidores? (activo y con token) */
export async function providerIsReady(): Promise<boolean> {
  const { provider } = await readSettings();
  return provider.enabled && !!provider.token;
}
