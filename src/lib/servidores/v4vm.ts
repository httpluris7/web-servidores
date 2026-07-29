import type { ProviderSettings } from "@/lib/ajustes";

/**
 * Cliente de la API del proveedor de servidores (v4vm, que expone SolusVM 2).
 *
 * Mismo criterio que `lib/payments/stripe.ts`: hablamos por REST con `fetch`,
 * sin SDK, y el token se pasa siempre como argumento —viene de `lib/ajustes.ts`—
 * para que no se cuele en un log ni en un mensaje de error. El token da control
 * total sobre los VPS (encender, reinstalar, borrar), así que NUNCA sale del
 * servidor: el navegador habla solo con nuestras rutas `/api/admin/*`.
 *
 * Particularidades de esta API que condicionan el código de abajo:
 *
 *  - Las listas van paginadas de 50 en 50 (`meta.last_page`).
 *  - No hay un "listar todos mis servidores": hay que recorrer los proyectos.
 *  - Limita el número de peticiones y responde 429 con `retry-after`.
 */

const TIMEOUT_MS = 20_000;

/** Tope de páginas por listado: 20 × 50 = 1000 elementos. Evita bucles. */
const MAX_PAGES = 20;

export class ProviderError extends Error {
  readonly status: number;
  /** Segundos que pide esperar el proveedor cuando corta por exceso (429). */
  readonly retryAfter: number | null;
  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export type ProviderConfig = Pick<ProviderSettings, "apiUrl" | "token">;

/* ------------------------------- Transporte ------------------------------- */

/** Une base y ruta sin duplicar ni perder barras. */
function endpoint(apiUrl: string, path: string): string {
  return `${apiUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function request<T>(cfg: ProviderConfig, path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(endpoint(cfg.apiUrl, path), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    throw new ProviderError(
      err instanceof Error && err.name === "AbortError"
        ? "The provider did not respond in time."
        : "Could not reach the provider.",
      0
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) {
    const seconds = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
    throw new ProviderError(
      "The provider is rate limiting requests.",
      429,
      Number.isFinite(seconds) ? seconds : null
    );
  }

  const json = (await res.json().catch(() => null)) as { message?: string } | null;

  if (!res.ok) {
    // 401 es el caso habitual (token caducado o mal copiado) y conviene que se
    // distinga del resto para poder decírselo al admin con precisión.
    const detail =
      res.status === 401
        ? "The provider rejected the API token."
        : (json?.message ?? `HTTP ${res.status}`);
    throw new ProviderError(detail, res.status);
  }
  return json as T;
}

type Paginated<T> = { data?: T[]; meta?: { current_page?: number; last_page?: number } };

/** Recorre todas las páginas de un listado y devuelve los elementos juntos. */
async function requestAll<T>(cfg: ProviderConfig, path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await request<Paginated<T>>(cfg, `${path}${sep}page=${page}`);
    out.push(...(res.data ?? []));
    const last = res.meta?.last_page ?? 1;
    if (page >= last) break;
  }
  return out;
}

/* -------------------------------- Modelos --------------------------------- */

export type ProviderProject = {
  id: number;
  name: string;
  isDefault: boolean;
  /** Nº de servidores que declara el proveedor (informativo). */
  servers: number;
};

export type ProviderServer = {
  id: number;
  uuid: string;
  name: string;
  description: string;
  /** Estado del proveedor: started, stopped, restarting… */
  status: string;
  /** Estado real del hipervisor, cuando difiere del anterior. */
  realStatus: string | null;
  /** true mientras hay una tarea en curso (reinstalación, arranque…). */
  isProcessing: boolean;
  isSuspended: boolean;
  progress: number | null;
  osType: string | null;
  plan: string | null;
  location: string | null;
  ipv4: string[];
  ipv6: string[];
  vcpu: number | null;
  ramMb: number | null;
  diskGb: number | null;
  projectId: number | null;
  projectName: string | null;
  createdAt: string | null;
};

/* -------------------------------- Mapeadores ------------------------------ */

type RawIp = { ip?: string };

type RawServer = {
  id?: number;
  uuid?: string;
  name?: string;
  description?: string;
  status?: string;
  real_status?: string;
  is_processing?: boolean;
  is_suspended?: boolean;
  progress?: number;
  os_type?: string;
  created_at?: string;
  plan?: { name?: string } | null;
  location?: { name?: string } | null;
  project?: { id?: number; name?: string } | null;
  specifications?: { vcpu?: number; ram?: number; disk?: number } | null;
  ip_addresses?: { ipv4?: RawIp[]; ipv6?: RawIp[] } | null;
};

const ips = (list: RawIp[] | undefined): string[] =>
  (list ?? []).map((i) => i.ip).filter((ip): ip is string => !!ip);

function toServer(raw: RawServer, project?: ProviderProject): ProviderServer {
  const specs = raw.specifications ?? {};
  return {
    id: Number(raw.id ?? 0),
    uuid: raw.uuid ?? "",
    name: raw.name ?? "",
    description: raw.description ?? "",
    status: raw.status ?? "unknown",
    realStatus: raw.real_status ?? null,
    isProcessing: raw.is_processing === true,
    isSuspended: raw.is_suspended === true,
    progress: typeof raw.progress === "number" ? raw.progress : null,
    osType: raw.os_type ?? null,
    plan: raw.plan?.name ?? null,
    location: raw.location?.name ?? null,
    ipv4: ips(raw.ip_addresses?.ipv4),
    ipv6: ips(raw.ip_addresses?.ipv6),
    vcpu: typeof specs.vcpu === "number" ? specs.vcpu : null,
    // La API da la RAM en bytes; la pasamos a MiB, que es como se habla de ella.
    ramMb: typeof specs.ram === "number" ? Math.round(specs.ram / 1024 / 1024) : null,
    diskGb: typeof specs.disk === "number" ? specs.disk : null,
    projectId: raw.project?.id ?? project?.id ?? null,
    projectName: raw.project?.name ?? project?.name ?? null,
    createdAt: raw.created_at ?? null,
  };
}

/* -------------------------------- Consultas ------------------------------- */

/** Comprueba el token y devuelve de qué cuenta del proveedor es. */
export async function verifyToken(
  cfg: ProviderConfig
): Promise<{ id: number | null; email: string | null; status: string | null }> {
  const res = await request<{ data?: { id?: number; email?: string; status?: string } }>(
    cfg,
    "/account"
  );
  return {
    id: res.data?.id ?? null,
    email: res.data?.email ?? null,
    status: res.data?.status ?? null,
  };
}

export async function listProjects(cfg: ProviderConfig): Promise<ProviderProject[]> {
  const raw = await requestAll<{
    id?: number;
    name?: string;
    is_default?: boolean;
    servers?: number;
  }>(cfg, "/projects");
  return raw.map((p) => ({
    id: Number(p.id ?? 0),
    name: p.name ?? "",
    isDefault: p.is_default === true,
    servers: typeof p.servers === "number" ? p.servers : 0,
  }));
}

/**
 * Todos los servidores de la cuenta. No existe un endpoint que los liste de
 * una vez: hay que pedir los proyectos y luego los servidores de cada uno.
 */
export async function listAllServers(cfg: ProviderConfig): Promise<ProviderServer[]> {
  const projects = await listProjects(cfg);
  const out: ProviderServer[] = [];
  // En serie y no en paralelo: son pocas peticiones y la API limita el ritmo.
  for (const project of projects) {
    const raw = await requestAll<RawServer>(cfg, `/projects/${project.id}/servers`);
    out.push(...raw.map((s) => toServer(s, project)));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Un servidor concreto, o null si el token no lo ve (ajeno o inexistente). */
export async function getServer(
  cfg: ProviderConfig,
  id: number
): Promise<ProviderServer | null> {
  try {
    const res = await request<{ data?: RawServer }>(cfg, `/servers/${id}`);
    return res.data ? toServer(res.data) : null;
  } catch (err) {
    if (err instanceof ProviderError && err.status === 404) return null;
    throw err;
  }
}
