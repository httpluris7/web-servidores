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

/**
 * Avisos por umbral sobre las métricas que envía el agente.
 *
 * Un umbral a 0 desactiva esa regla, que es más claro que un interruptor por
 * regla: quien no quiera vigilar la CPU pone 0 y se acabó.
 */
export type AlertSettings = {
  enabled: boolean;
  /** Destinatarios separados por coma. Vacío = el buzón de administración. */
  destinatarios: string;
  /** Umbrales en % (0 = regla desactivada). */
  cpu: number;
  memoria: number;
  disco: number;
  /**
   * Minutos que el valor debe estar por encima antes de avisar. Evita que un
   * pico de un minuto —un backup, un `apt upgrade`— genere un correo.
   * El disco no lo usa: si está lleno, lo está.
   */
  sostenido: number;
  /** Avisar si el agente lleva estos minutos sin enviar (0 = no avisar). */
  agenteCaido: number;
  /** Repetir el aviso cada estas horas mientras siga activo (0 = una sola vez). */
  recordatorio: number;
};

/**
 * Copias de seguridad automáticas (módulo `lib/backup`).
 *
 * Guarda SECRETOS: la frase de cifrado del backup, el token de Dropbox y la
 * clave privada del SFTP. Por eso vive aquí, en el mismo fichero 0600 que el
 * resto, y nunca sale en claro del servidor (la API lo enmascara).
 *
 * Aviso sobre la frase de paso: el servidor la guarda para poder cifrar el
 * backup diario sin intervención, pero para RESTAURAR en otro servidor hay que
 * teclearla a mano (el servidor original puede estar muerto). Quien la configura
 * tiene que apuntarla también fuera de aquí; si se pierde, los backups son
 * irrecuperables. El cifrado protege la copia en el tercero (Dropbox/SFTP), no
 * frente a alguien que ya controle este servidor.
 */
export type BackupDropbox = {
  /** Token de acceso (puede ser de corta duración). */
  accessToken: string;
  /** Alternativa recomendada: refresh token + app, que no caduca. */
  refreshToken: string;
  appKey: string;
  appSecret: string;
  /** Carpeta destino en Dropbox, p.ej. `/viahost-backups`. */
  folder: string;
};

export type BackupSftp = {
  host: string;
  port: number;
  user: string;
  /** Carpeta destino en el servidor SFTP (absoluta o relativa al home). */
  dir: string;
  /** Clave privada SSH en PEM (secreto). Se escribe a un fichero 0600 al usarla. */
  privateKey: string;
};

export type BackupSettings = {
  /** Programación diaria activa. */
  enabled: boolean;
  /** Hora local (0-23) del backup diario. */
  hour: number;
  /** Frase de cifrado del backup (secreto). Sin ella no se genera nada. */
  passphrase: string;
  /** Cuántas copias conservar (local y en cada destino). 0 = no purgar. */
  retain: number;
  /** Guardar además una copia local en `data/backups/`. */
  keepLocal: boolean;
  dropboxEnabled: boolean;
  sftpEnabled: boolean;
  dropbox: BackupDropbox;
  sftp: BackupSftp;
};

/**
 * Conciliación de transferencias por Wise (módulo `lib/payments/wise*`).
 *
 * Guarda SECRETOS: el token de API de Wise y la CLAVE PRIVADA RSA que firma el
 * reto SCA (sin la cual no se pueden leer los movimientos). Por eso vive aquí,
 * en el mismo fichero 0600 que el resto, y nunca sale en claro del servidor.
 *
 * `sandbox` decide contra qué API se habla (`api.sandbox.transferwise.tech` vs
 * `api.wise.com`): se prueba primero en sandbox, sin mover dinero real.
 */
export type WiseSettings = {
  /** Interruptor: sin esto no se sondea Wise aunque haya credenciales. */
  enabled: boolean;
  /** true = API sandbox (pruebas); false = producción (api.wise.com). */
  sandbox: boolean;
  /** Token de API (viaja como `Authorization: Bearer …`). */
  apiToken: string;
  /** Id del perfil (business) del que se lee el statement. */
  profileId: string;
  /** Id del balance EUR del que se leen los ingresos. */
  balanceId: string;
  /** Clave privada RSA en PEM que firma el reto SCA (secreto). */
  privateKey: string;
};

export type Settings = {
  stripe: StripeSettings;
  provider: ProviderSettings;
  alerts: AlertSettings;
  backup: BackupSettings;
  wise: WiseSettings;
};

/** Valores de partida de Wise: apagado y en sandbox (pruebas sin dinero real). */
export const DEFAULT_WISE: WiseSettings = {
  enabled: false,
  sandbox: true,
  apiToken: "",
  profileId: "",
  balanceId: "",
  privateKey: "",
};

/** Valores de partida de las copias de seguridad: a las 03:00, sin destinos. */
export const DEFAULT_BACKUP: BackupSettings = {
  enabled: false,
  hour: 3,
  passphrase: "",
  retain: 14,
  keepLocal: true,
  dropboxEnabled: false,
  sftpEnabled: false,
  dropbox: { accessToken: "", refreshToken: "", appKey: "", appSecret: "", folder: "/viahost-backups" },
  sftp: { host: "", port: 22, user: "", dir: "viahost-backups", privateKey: "" },
};

/** Base de la API del proveedor actual, si no se configura otra. */
export const DEFAULT_PROVIDER_API_URL = "https://manage.v4vm.com/api/v1";

/**
 * Valores de partida. Un 90% sostenido un cuarto de hora es la frontera
 * habitual entre "está trabajando" y "hay un problema"; por debajo de eso los
 * avisos se vuelven ruido y se acaban ignorando, que es peor que no tenerlos.
 */
export const DEFAULT_ALERTS: AlertSettings = {
  enabled: true,
  destinatarios: "",
  cpu: 90,
  memoria: 90,
  disco: 90,
  sostenido: 15,
  agenteCaido: 20,
  recordatorio: 24,
};

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

function wiseFromEnv(): WiseSettings {
  return {
    enabled: false,
    // Por defecto sandbox; solo se va a producción poniendo WISE_SANDBOX=false.
    sandbox: (process.env.WISE_SANDBOX || "").trim().toLowerCase() !== "false",
    apiToken: (process.env.WISE_API_TOKEN || "").trim(),
    profileId: (process.env.WISE_PROFILE_ID || "").trim(),
    balanceId: (process.env.WISE_BALANCE_ID || "").trim(),
    // La clave puede venir con \n escapados si se guarda en una sola línea de .env.
    privateKey: (process.env.WISE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
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

/** Entero acotado; fuera de rango o ausente, se queda el valor por defecto. */
function entero(v: unknown, min: number, max: number, porDefecto: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return porDefecto;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function normalizeAlerts(raw: unknown): AlertSettings {
  const o = (raw ?? {}) as Partial<Record<keyof AlertSettings, unknown>>;
  return {
    // Sin sección guardada, `o.enabled` es undefined y los avisos quedan
    // activos: es lo que espera quien acaba de configurar los umbrales.
    enabled: o.enabled === undefined ? DEFAULT_ALERTS.enabled : o.enabled === true,
    destinatarios:
      typeof o.destinatarios === "string" ? o.destinatarios.trim() : DEFAULT_ALERTS.destinatarios,
    cpu: entero(o.cpu, 0, 100, DEFAULT_ALERTS.cpu),
    memoria: entero(o.memoria, 0, 100, DEFAULT_ALERTS.memoria),
    disco: entero(o.disco, 0, 100, DEFAULT_ALERTS.disco),
    sostenido: entero(o.sostenido, 1, 720, DEFAULT_ALERTS.sostenido),
    agenteCaido: entero(o.agenteCaido, 0, 1440, DEFAULT_ALERTS.agenteCaido),
    recordatorio: entero(o.recordatorio, 0, 720, DEFAULT_ALERTS.recordatorio),
  };
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeBackup(raw: unknown): BackupSettings {
  const o = (raw ?? {}) as Partial<Record<keyof BackupSettings, unknown>>;
  const d = (o.dropbox ?? {}) as Partial<Record<keyof BackupDropbox, unknown>>;
  const s = (o.sftp ?? {}) as Partial<Record<keyof BackupSftp, unknown>>;
  return {
    enabled: o.enabled === true,
    hour: entero(o.hour, 0, 23, DEFAULT_BACKUP.hour),
    passphrase: texto(o.passphrase),
    retain: entero(o.retain, 0, 365, DEFAULT_BACKUP.retain),
    keepLocal: o.keepLocal === undefined ? DEFAULT_BACKUP.keepLocal : o.keepLocal === true,
    dropboxEnabled: o.dropboxEnabled === true,
    sftpEnabled: o.sftpEnabled === true,
    dropbox: {
      accessToken: texto(d.accessToken),
      refreshToken: texto(d.refreshToken),
      appKey: texto(d.appKey),
      appSecret: texto(d.appSecret),
      folder: texto(d.folder) || DEFAULT_BACKUP.dropbox.folder,
    },
    sftp: {
      host: texto(s.host),
      port: entero(s.port, 1, 65535, DEFAULT_BACKUP.sftp.port),
      user: texto(s.user),
      dir: texto(s.dir) || DEFAULT_BACKUP.sftp.dir,
      privateKey: typeof s.privateKey === "string" ? s.privateKey : "",
    },
  };
}

function normalizeWise(raw: unknown, fallback: WiseSettings): WiseSettings {
  const o = (raw ?? {}) as Partial<Record<keyof WiseSettings, unknown>>;
  const apiToken = typeof o.apiToken === "string" ? o.apiToken.trim() : "";
  const profileId = typeof o.profileId === "string" ? o.profileId.trim() : "";
  const balanceId = typeof o.balanceId === "string" ? o.balanceId.trim() : "";
  const privateKey = typeof o.privateKey === "string" ? o.privateKey : "";
  return {
    enabled: o.enabled === true,
    // Sin valor guardado, sandbox por defecto: nunca ir a producción por omisión.
    sandbox: o.sandbox === undefined ? fallback.sandbox : o.sandbox === true,
    apiToken: apiToken || fallback.apiToken,
    profileId: profileId || fallback.profileId,
    balanceId: balanceId || fallback.balanceId,
    privateKey: privateKey || fallback.privateKey,
  };
}

/** Ajustes efectivos (fichero sobre entorno). Nunca lanza: sin fichero, vacíos. */
export async function readSettings(): Promise<Settings> {
  const env = fromEnv();
  const providerEnv = providerFromEnv();
  const wiseEnv = wiseFromEnv();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    // Sin fichero (o ilegible/corrupto): nos quedamos con el entorno.
    // Si el entorno trae claves, damos por activo el cobro por Stripe.
    return {
      stripe: { ...env, enabled: !!env.secretKey || !!env.webhookSecret },
      provider: { ...providerEnv, enabled: !!providerEnv.token },
      alerts: { ...DEFAULT_ALERTS },
      backup: { ...DEFAULT_BACKUP },
      wise: { ...wiseEnv },
    };
  }
  const obj = (parsed ?? {}) as {
    stripe?: unknown;
    provider?: unknown;
    alerts?: unknown;
    backup?: unknown;
    wise?: unknown;
  };
  return {
    stripe: normalizeStripe(obj.stripe, env),
    provider: normalizeProvider(obj.provider, providerEnv),
    alerts: normalizeAlerts(obj.alerts),
    backup: normalizeBackup(obj.backup),
    wise: normalizeWise(obj.wise, wiseEnv),
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

/** Aplica cambios parciales de los avisos por umbral. */
export async function updateAlertSettings(patch: Partial<AlertSettings>): Promise<Settings> {
  const current = await readSettings();
  const next: Settings = {
    ...current,
    alerts: normalizeAlerts({ ...current.alerts, ...patch }),
  };
  await writeSettings(next);
  return next;
}

/**
 * Cambios parciales de las copias de seguridad. Los secretos siguen la misma
 * regla que Stripe: cadena vacía o ausente = "no lo toques"; `null` = borrarlo.
 * Así el formulario, que nunca recibe los secretos, no puede borrarlos sin querer.
 */
export type BackupPatch = {
  enabled?: boolean;
  hour?: number;
  passphrase?: string | null;
  retain?: number;
  keepLocal?: boolean;
  dropboxEnabled?: boolean;
  sftpEnabled?: boolean;
  dropbox?: {
    accessToken?: string | null;
    refreshToken?: string | null;
    appKey?: string;
    appSecret?: string | null;
    folder?: string;
  };
  sftp?: {
    host?: string;
    port?: number;
    user?: string;
    dir?: string;
    privateKey?: string | null;
  };
};

export async function updateBackupSettings(patch: BackupPatch): Promise<Settings> {
  const current = await readSettings();
  const b = current.backup;
  const pd = patch.dropbox ?? {};
  const ps = patch.sftp ?? {};
  const merged: BackupSettings = {
    enabled: patch.enabled ?? b.enabled,
    hour: patch.hour ?? b.hour,
    passphrase: pickSecret(patch.passphrase, b.passphrase),
    retain: patch.retain ?? b.retain,
    keepLocal: patch.keepLocal ?? b.keepLocal,
    dropboxEnabled: patch.dropboxEnabled ?? b.dropboxEnabled,
    sftpEnabled: patch.sftpEnabled ?? b.sftpEnabled,
    dropbox: {
      accessToken: pickSecret(pd.accessToken, b.dropbox.accessToken),
      refreshToken: pickSecret(pd.refreshToken, b.dropbox.refreshToken),
      appKey: (pd.appKey ?? "").trim() || b.dropbox.appKey,
      appSecret: pickSecret(pd.appSecret, b.dropbox.appSecret),
      folder: (pd.folder ?? "").trim() || b.dropbox.folder,
    },
    sftp: {
      host: (ps.host ?? "").trim() || b.sftp.host,
      port: ps.port ?? b.sftp.port,
      user: (ps.user ?? "").trim() || b.sftp.user,
      dir: (ps.dir ?? "").trim() || b.sftp.dir,
      privateKey: pickSecret(ps.privateKey, b.sftp.privateKey),
    },
  };
  const next: Settings = { ...current, backup: normalizeBackup(merged) };
  await writeSettings(next);
  return next;
}

/**
 * Cambios parciales de Wise. El token y la clave privada siguen la regla de los
 * secretos (cadena vacía o ausente = "no lo toques"; `null` = borrarlo); el
 * resto se sobrescribe con lo que llegue.
 */
export type WisePatch = {
  enabled?: boolean;
  sandbox?: boolean;
  apiToken?: string | null;
  profileId?: string;
  balanceId?: string;
  privateKey?: string | null;
};

export async function updateWiseSettings(patch: WisePatch): Promise<Settings> {
  const current = await readSettings();
  const w = current.wise;
  const next: Settings = {
    ...current,
    wise: {
      enabled: patch.enabled ?? w.enabled,
      sandbox: patch.sandbox ?? w.sandbox,
      apiToken: pickSecret(patch.apiToken, w.apiToken),
      profileId: (patch.profileId ?? "").trim() || w.profileId,
      balanceId: (patch.balanceId ?? "").trim() || w.balanceId,
      privateKey: pickSecret(patch.privateKey, w.privateKey),
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

/**
 * ¿Están completas las credenciales de Wise para conciliar? (independiente del
 * interruptor `enabled`, que decide si el sondeo automático corre). Hacen falta
 * las cuatro cosas: token, perfil, balance y clave privada para el SCA.
 */
export function wiseHasCreds(wise: WiseSettings): boolean {
  return !!wise.apiToken && !!wise.profileId && !!wise.balanceId && !!wise.privateKey;
}

/** ¿Se puede sondear Wise ahora mismo? (activo y con credenciales completas) */
export async function wiseIsReady(): Promise<boolean> {
  const { wise } = await readSettings();
  return wise.enabled && wiseHasCreds(wise);
}
