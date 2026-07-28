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

export type Settings = { stripe: StripeSettings };

/* --------------------------------- Lectura -------------------------------- */

function fromEnv(): StripeSettings {
  return {
    enabled: false,
    secretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
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

/** Ajustes efectivos (fichero sobre entorno). Nunca lanza: sin fichero, vacíos. */
export async function readSettings(): Promise<Settings> {
  const env = fromEnv();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    // Sin fichero (o ilegible/corrupto): nos quedamos con el entorno.
    // Si el entorno trae claves, damos por activo el cobro por Stripe.
    return { stripe: { ...env, enabled: !!env.secretKey || !!env.webhookSecret } };
  }
  const obj = (parsed ?? {}) as { stripe?: unknown };
  return { stripe: normalizeStripe(obj.stripe, env) };
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
 * Aplica cambios parciales de Stripe. Una cadena vacía significa "deja la que
 * ya había" (el formulario no recibe nunca los secretos, así que no puede
 * reenviarlos); para borrar una clave se envía `null`.
 */
export async function updateStripeSettings(patch: {
  enabled?: boolean;
  secretKey?: string | null;
  webhookSecret?: string | null;
}): Promise<Settings> {
  const current = (await readSettings()).stripe;
  const pick = (value: string | null | undefined, previous: string): string => {
    if (value === null) return "";
    if (value === undefined) return previous;
    const trimmed = value.trim();
    return trimmed === "" ? previous : trimmed;
  };
  const next: Settings = {
    stripe: {
      enabled: patch.enabled ?? current.enabled,
      secretKey: pick(patch.secretKey, current.secretKey),
      webhookSecret: pick(patch.webhookSecret, current.webhookSecret),
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
 */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length < 12) return "•".repeat(8);
  const head = value.slice(0, value.lastIndexOf("_") + 1 || 3);
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
