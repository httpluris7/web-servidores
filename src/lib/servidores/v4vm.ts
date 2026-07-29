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

type RequestInit_ = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown };

async function request<T>(
  cfg: ProviderConfig,
  path: string,
  init: RequestInit_ = {}
): Promise<T> {
  const method = init.method ?? "GET";
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(endpoint(cfg.apiUrl, path), {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
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

  // 204 y otras respuestas sin cuerpo son válidas en las acciones.
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
  return (json ?? {}) as T;
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
  /** Consumo instantáneo, cuando el proveedor lo incluye. */
  usage: {
    cpuPct: number | null;
    diskBytes: number | null;
    trafficInBytes: number | null;
    trafficOutBytes: number | null;
    trafficExceeded: boolean;
  };
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
  usage?: {
    cpu?: number;
    disk?: { actual_size?: number } | null;
    network?: {
      incoming?: { value?: number; is_exceeded?: boolean } | null;
      outgoing?: { value?: number; is_exceeded?: boolean } | null;
    } | null;
  } | null;
};

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

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
    usage: {
      cpuPct: num(raw.usage?.cpu),
      diskBytes: num(raw.usage?.disk?.actual_size),
      trafficInBytes: num(raw.usage?.network?.incoming?.value),
      trafficOutBytes: num(raw.usage?.network?.outgoing?.value),
      trafficExceeded:
        raw.usage?.network?.incoming?.is_exceeded === true ||
        raw.usage?.network?.outgoing?.is_exceeded === true,
    },
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

/** Consumo frente a los límites del plan (tráfico, sobre todo). */
export type ServerLimit = {
  name: string;
  used: number;
  limit: number | null;
  unit: string | null;
  isExceeded: boolean;
};

export async function listServerLimits(
  cfg: ProviderConfig,
  id: number
): Promise<ServerLimit[]> {
  const res = await request<{
    data?: {
      name?: string;
      used?: number;
      is_exceeded?: boolean;
      limit?: { limit?: number; is_enabled?: boolean; unit?: string } | null;
    }[];
  }>(cfg, `/servers/${id}/limits`);
  return (res.data ?? [])
    // Un límite deshabilitado no dice nada al cliente: se omite.
    .filter((l) => l.limit?.is_enabled !== false)
    .map((l) => ({
      name: l.name ?? "",
      used: l.used ?? 0,
      limit: num(l.limit?.limit),
      unit: l.limit?.unit ?? null,
      isExceeded: l.is_exceeded === true,
    }));
}

/* -------------------------------- Acciones -------------------------------- */

/**
 * Las acciones son ASÍNCRONAS: el proveedor responde con una tarea, no con el
 * resultado. Y esta versión de la API no expone endpoint de tareas, así que el
 * seguimiento se hace releyendo el servidor (`is_processing` / `progress`).
 * Por eso ninguna de estas funciones devuelve el estado final.
 */

export async function startServer(cfg: ProviderConfig, id: number): Promise<void> {
  await request(cfg, `/servers/${id}/start`, { method: "POST" });
}

export async function stopServer(
  cfg: ProviderConfig,
  id: number,
  force = false
): Promise<void> {
  await request(cfg, `/servers/${id}/stop`, { method: "POST", body: { force } });
}

export async function restartServer(
  cfg: ProviderConfig,
  id: number,
  force = false
): Promise<void> {
  await request(cfg, `/servers/${id}/restart`, { method: "POST", body: { force } });
}

/** Reinstala el sistema. BORRA TODOS LOS DATOS del servidor. */
export async function reinstallServer(
  cfg: ProviderConfig,
  id: number,
  opts: { osVersionId: number; sshKeyIds?: number[] }
): Promise<void> {
  await request(cfg, `/servers/${id}/reinstall`, {
    method: "POST",
    body: {
      os: opts.osVersionId,
      ...(opts.sshKeyIds?.length ? { ssh_keys: opts.sshKeyIds } : {}),
    },
  });
}

/**
 * Genera una contraseña de root nueva y la devuelve.
 *
 * `send_password_to_current_user` se queda en `false` a propósito: si se activa,
 * el proveedor manda la contraseña por correo al dueño de la cuenta —que somos
 * NOSOTROS, no el cliente—. Se la enseñamos una sola vez en pantalla y no la
 * guardamos en ningún sitio.
 */
export async function resetRootPassword(
  cfg: ProviderConfig,
  id: number
): Promise<string | null> {
  const res = await request<{ data?: { password?: string } }>(
    cfg,
    `/servers/${id}/reset_password`,
    { method: "POST", body: { send_password_to_current_user: false } }
  );
  return res.data?.password ?? null;
}

/** Abre una consola VNC y devuelve la URL temporal a la que enviar al cliente. */
export async function openVncConsole(
  cfg: ProviderConfig,
  id: number
): Promise<string | null> {
  const res = await request<{ url?: string; vnc_proxy_url?: string }>(
    cfg,
    `/servers/${id}/vnc_up`,
    { method: "POST" }
  );
  // El proxy es el que sabe descifrar la URL: si viene, es el que hay que abrir.
  return res.vnc_proxy_url ?? res.url ?? null;
}

/* ------------------------------- Instantáneas ----------------------------- */

export type ProviderSnapshot = {
  id: number;
  name: string;
  status: string;
  sizeBytes: number | null;
  createdAt: string | null;
};

export async function listSnapshots(
  cfg: ProviderConfig,
  id: number
): Promise<ProviderSnapshot[]> {
  const res = await request<{
    data?: { id?: number; name?: string; status?: string; size?: number; created_at?: string }[];
  }>(cfg, `/servers/${id}/snapshots`);
  return (res.data ?? []).map((s) => ({
    id: Number(s.id ?? 0),
    name: s.name ?? "",
    status: s.status ?? "unknown",
    sizeBytes: num(s.size),
    createdAt: s.created_at ?? null,
  }));
}

export async function createSnapshot(
  cfg: ProviderConfig,
  id: number,
  name: string
): Promise<void> {
  await request(cfg, `/servers/${id}/snapshots`, { method: "POST", body: { name } });
}

/** Devuelve el servidor al estado de la instantánea. Descarta lo posterior. */
export async function revertSnapshot(cfg: ProviderConfig, snapshotId: number): Promise<void> {
  await request(cfg, `/snapshots/${snapshotId}/revert`, { method: "POST" });
}

export async function deleteSnapshot(cfg: ProviderConfig, snapshotId: number): Promise<void> {
  await request(cfg, `/snapshots/${snapshotId}`, { method: "DELETE" });
}

/* ------------------------------ Sistemas y claves ------------------------- */

/** Una versión concreta instalable: es el id que espera `reinstall`. */
export type ProviderOsOption = {
  /** Id de la VERSIÓN, que es lo que pide el endpoint de reinstalación. */
  id: number;
  /** Etiqueta lista para mostrar: "Ubuntu 24.04". */
  label: string;
  family: string;
  supportsSshKeys: boolean;
};

export async function listOsOptions(cfg: ProviderConfig): Promise<ProviderOsOption[]> {
  const raw = await requestAll<{
    name?: string;
    is_visible?: boolean;
    versions?: {
      id?: number;
      version?: string;
      is_visible?: boolean;
      is_deprecated?: boolean;
      is_ssh_keys_supported?: boolean;
      position?: number;
    }[];
  }>(cfg, "/os_images");

  const out: ProviderOsOption[] = [];
  for (const image of raw) {
    if (image.is_visible === false) continue;
    for (const v of image.versions ?? []) {
      // Las versiones ocultas o retiradas no deben ofrecerse al cliente.
      if (!v.id || v.is_visible === false || v.is_deprecated === true) continue;
      out.push({
        id: v.id,
        label: `${image.name ?? ""} ${v.version ?? ""}`.trim(),
        family: image.name ?? "",
        supportsSshKeys: v.is_ssh_keys_supported === true,
      });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export type ProviderSshKey = { id: number; name: string };

export async function listProjectSshKeys(
  cfg: ProviderConfig,
  projectId: number
): Promise<ProviderSshKey[]> {
  const raw = await requestAll<{ id?: number; name?: string }>(
    cfg,
    `/projects/${projectId}/ssh_keys`
  );
  return raw
    .filter((k) => !!k.id)
    .map((k) => ({ id: k.id as number, name: k.name ?? `#${k.id}` }));
}
