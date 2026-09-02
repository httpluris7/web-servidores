import "server-only";
import { readSettings, type HostingSettings } from "@/lib/ajustes";

/**
 * Cliente mínimo de la WHM API 1 del nodo cPanel (web01), sobre HTTPS :2087.
 *
 * Autenticación por API token de root (`Authorization: whm root:<token>`), con
 * ACL acotada (create-acct, list-accts, passwd). Nos conectamos por el HOSTNAME
 * (`web01.viahost.top`), no por IP, para que el certificado Let's Encrypt del
 * panel valide sin desactivar la verificación TLS.
 *
 * Solo lo que necesita el aprovisionamiento de hosting: crear cuenta, comprobar
 * si existe (idempotencia) y —de reserva— cambiar contraseña. Nunca cachea el
 * token: se lee de los ajustes en cada operación.
 */

const PORT = 2087;
const TIMEOUT_MS = 25_000;

export class WhmError extends Error {
  constructor(
    public reason: string,
    message: string,
  ) {
    super(message);
    this.name = "WhmError";
  }
}

type WhmConfig = { host: string; token: string };

/** Config activa, o `null` si el hosting no está configurado/encendido. */
async function config(): Promise<WhmConfig | null> {
  const { hosting } = await readSettings();
  return hostingConfig(hosting);
}

function hostingConfig(hosting: HostingSettings): WhmConfig | null {
  if (!hosting.enabled) return null;
  const host = hosting.whmHost.trim();
  const token = hosting.whmToken.trim();
  if (!host || !token) return null;
  return { host, token };
}

async function call(fn: string, params: Record<string, string | number>, cfg: WhmConfig): Promise<Record<string, unknown>> {
  const url = new URL(`https://${cfg.host}:${PORT}/json-api/${fn}`);
  url.searchParams.set("api.version", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `whm root:${cfg.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new WhmError("network", err instanceof Error ? err.message : "WHM unreachable");
  }
  if (!res.ok) {
    throw new WhmError("http", `WHM ${fn} → HTTP ${res.status}`);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new WhmError("parse", `WHM ${fn}: respuesta no JSON`);
  }
  const meta = (data as { metadata?: { result?: number; reason?: string } }).metadata;
  if (!meta || meta.result !== 1) {
    throw new WhmError("api", `WHM ${fn}: ${meta?.reason ?? "resultado no OK"}`);
  }
  return (data as { data?: Record<string, unknown> }).data ?? {};
}

/** ¿Existe ya una cuenta con este usuario? (idempotencia del alta). */
export async function accountExists(username: string): Promise<boolean> {
  const cfg = await config();
  if (!cfg) throw new WhmError("unconfigured", "Hosting/WHM sin configurar");
  const data = await call("listaccts", { "api.version": 1, search: username, searchtype: "user" }, cfg);
  const acct = data.acct;
  return Array.isArray(acct) && acct.length > 0;
}

export type CreateAccountInput = {
  username: string;
  domain: string;
  plan: string; // paquete de cPanel
  password: string;
  contactemail: string;
};

/**
 * Crea una cuenta de cPanel. Idempotente en la práctica: si el usuario ya
 * existe (mismo `order_ref` → mismo username determinista), WHM devuelve un
 * error de "ya existe" que traducimos a `already: true` en vez de lanzar.
 */
export async function createAccount(
  input: CreateAccountInput,
): Promise<{ ok: true; already: boolean }> {
  const cfg = await config();
  if (!cfg) throw new WhmError("unconfigured", "Hosting/WHM sin configurar");
  try {
    await call(
      "createacct",
      {
        username: input.username,
        domain: input.domain,
        plan: input.plan,
        password: input.password,
        contactemail: input.contactemail,
        // Sin correo de bienvenida de cPanel: las credenciales las mandamos
        // nosotros, en el idioma del cliente y con nuestra marca.
        skip_email: 1,
        reseller: 0,
      },
      cfg,
    );
    return { ok: true, already: false };
  } catch (err) {
    if (err instanceof WhmError && /already exists|ya existe/i.test(err.message)) {
      return { ok: true, already: true };
    }
    throw err;
  }
}

/**
 * Cambia la contraseña de acceso de una cuenta de cPanel (ACL `passwd`).
 *
 * No toca las contraseñas de las bases de datos (`db_pass_update=0`) para no
 * romper sitios ya conectados; solo cambia el acceso a cPanel/FTP/webmail.
 */
export async function changeAccountPassword(username: string, password: string): Promise<void> {
  const cfg = await config();
  if (!cfg) throw new WhmError("unconfigured", "Hosting/WHM sin configurar");
  await call("passwd", { user: username, password, db_pass_update: 0 }, cfg);
}

/** ¿El hosting está configurado y encendido? (para decidir si se aprovisiona). */
export function hostingConfigured(hosting: HostingSettings): boolean {
  return hostingConfig(hosting) != null;
}

/** Comprueba la conexión con WHM (token + red + cert). Devuelve nº de cuentas. */
export async function pingWhm(): Promise<number> {
  const cfg = await config();
  if (!cfg) throw new WhmError("unconfigured", "Hosting/WHM sin configurar");
  const data = await call("listaccts", { "api.version": 1 }, cfg);
  const acct = data.acct;
  return Array.isArray(acct) ? acct.length : 0;
}
