import "server-only";
import { readSettings } from "@/lib/ajustes";

/**
 * Cliente de la API de Njalla (registrador de dominios con privacidad).
 *
 * SOLO servidor: usa el token de `data/ajustes.json` (`njalla.apiToken`), que
 * nunca debe llegar al cliente. API JSON-RPC en `https://njal.la/api/1/`,
 * cabecera `Authorization: Njalla <token>`, cuerpo `{ method, params }`.
 *
 * Modelo Njalla: revendedor con **monedero** (prepago) y **registrante-proxy**
 * (privacidad WHOIS incluida). Sin acreditación ICANN. Precios en EUR/año.
 */

const API_URL = "https://njal.la/api/1/";

export class NjallaError extends Error {
  constructor(
    message: string,
    readonly reason: "unconfigured" | "api" | "network" | "timeout" = "api",
    readonly code?: number,
  ) {
    super(message);
    this.name = "NjallaError";
  }
}

/**
 * Llamada JSON-RPC autenticada. Lee el token de los ajustes (sin caché). Njalla
 * acota los tokens por método: `write` elige el token de REGISTRO (register/
 * renew); el resto usa el de lectura/DNS.
 */
async function call<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  opts: { timeoutMs?: number; write?: boolean } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const { njalla } = await readSettings();
  const token = (opts.write ? njalla.registerToken : njalla.apiToken).trim();
  if (!token) {
    throw new NjallaError(
      opts.write ? "Njalla sin token de registro" : "Njalla sin token configurado",
      "unconfigured",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Njalla ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method, params }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new NjallaError(
      aborted ? "timeout hablando con Njalla" : `error de red: ${(err as Error).message}`,
      aborted ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: { result?: T; error?: { code?: number; message?: string } } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new NjallaError(`respuesta no-JSON de Njalla (${res.status})`, "api");
  }
  if (data.error) {
    throw new NjallaError(data.error.message || "error de Njalla", "api", data.error.code);
  }
  if (!res.ok) {
    throw new NjallaError(`Njalla respondió ${res.status}`, "api", res.status);
  }
  return data.result as T;
}

/* --------------------------------- Tipos ---------------------------------- */

export type DomainOffer = {
  name: string;
  /** "available" u otro (registrado, reservado…). */
  status: string;
  /** Precio de Njalla en EUR/año (coste nuestro), o null si no lo da. */
  price: number | null;
};

export type OwnedDomain = {
  name: string;
  /** Estado del dominio en Njalla (active, expired…). */
  status: string | null;
  /** Vencimiento ISO, si lo da. */
  expiry: string | null;
  /** Nameservers configurados. */
  nameservers: string[];
};

export type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number | null;
  /** Prioridad (MX/SRV). */
  prio: number | null;
};

/* ------------------------------- Operaciones ------------------------------ */

/** Saldo del monedero (EUR). Registrar/renovar descuenta de aquí. */
export async function getBalance(): Promise<number> {
  const r = await call<{ balance?: number }>("get-balance");
  return typeof r?.balance === "number" ? r.balance : 0;
}

/** Busca disponibilidad + precio por TLD para un término. */
export async function findDomains(query: string): Promise<DomainOffer[]> {
  const r = await call<{ domains?: Array<Record<string, unknown>> }>("find-domains", { query });
  const rows = r?.domains ?? [];
  return rows.map((d) => ({
    name: String(d.name ?? d.domain ?? ""),
    status: String(d.status ?? ""),
    price: typeof d.price === "number" ? d.price : null,
  }));
}

/** Comprueba un dominio concreto (nombre completo con TLD). */
export async function checkDomain(domain: string): Promise<DomainOffer | null> {
  const ofertas = await findDomains(domain);
  return ofertas.find((o) => o.name.toLowerCase() === domain.toLowerCase()) ?? null;
}

/** Registra un dominio (descuenta del monedero). Idempotencia la pone quien llama. */
export async function registerDomain(domain: string, years = 1): Promise<{ name: string }> {
  const r = await call<{ name?: string; domain?: string }>(
    "register-domain",
    { domain, years },
    { write: true },
  );
  return { name: String(r?.name ?? r?.domain ?? domain) };
}

/** Renueva un dominio por N años. */
export async function renewDomain(domain: string, years = 1): Promise<void> {
  await call("renew-domain", { domain, years }, { write: true });
}

/** Dominios de la cuenta (para renovaciones/panel). */
export async function listDomains(): Promise<OwnedDomain[]> {
  const r = await call<{ domains?: Array<Record<string, unknown>> }>("list-domains");
  return (r?.domains ?? []).map(adaptDomain);
}

/** Ficha de un dominio (vencimiento, NS, estado). */
export async function getDomain(domain: string): Promise<OwnedDomain | null> {
  try {
    const r = await call<Record<string, unknown>>("get-domain", { domain });
    return adaptDomain(r);
  } catch (err) {
    if (err instanceof NjallaError && err.reason === "api") return null;
    throw err;
  }
}

/** Fija los nameservers de un dominio. */
export async function setNameservers(domain: string, nameservers: string[]): Promise<void> {
  await call("edit-domain", { domain, nameservers });
}

/* ------------------------------- DNS (records) ---------------------------- */

export async function listRecords(domain: string): Promise<DnsRecord[]> {
  const r = await call<{ records?: Array<Record<string, unknown>> }>("list-records", { domain });
  return (r?.records ?? []).map((x) => ({
    id: String(x.id ?? ""),
    type: String(x.type ?? ""),
    name: String(x.name ?? ""),
    content: String(x.content ?? ""),
    ttl: typeof x.ttl === "number" ? x.ttl : null,
    prio: typeof x.prio === "number" ? x.prio : null,
  }));
}

export async function addRecord(
  domain: string,
  rec: { type: string; name: string; content: string; ttl?: number; prio?: number },
): Promise<{ id: string }> {
  const params: Record<string, unknown> = {
    domain,
    type: rec.type,
    name: rec.name,
    content: rec.content,
    ttl: rec.ttl ?? 3600,
  };
  if (rec.prio !== undefined) params.prio = rec.prio;
  const r = await call<{ id?: string | number }>("add-record", params);
  return { id: String(r?.id ?? "") };
}

export async function editRecord(
  domain: string,
  rec: { id: string; type?: string; name?: string; content?: string; ttl?: number; prio?: number },
): Promise<void> {
  await call("edit-record", { domain, ...rec });
}

export async function removeRecord(domain: string, id: string): Promise<void> {
  await call("remove-record", { domain, id });
}

/* -------------------------------- Helpers --------------------------------- */

function adaptDomain(d: Record<string, unknown>): OwnedDomain {
  const ns = Array.isArray(d.nameservers)
    ? (d.nameservers as unknown[]).map((n) => String(n))
    : [];
  return {
    name: String(d.name ?? d.domain ?? ""),
    status: typeof d.status === "string" ? d.status : null,
    expiry: typeof d.expiry === "string" ? d.expiry : typeof d.expires === "string" ? d.expires : null,
    nameservers: ns,
  };
}
