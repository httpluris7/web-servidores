import { readSettings } from "@/lib/ajustes";
import { listUsers } from "@/lib/auth";
import { agenteVivo, ultimasMuestras } from "./metricas";
import { listManagedServers, type ManagedServer } from "./store";
import { listAllServers, type ProviderConfig, type ProviderServer } from "./v4vm";

/**
 * Inventario del panel: cruza lo que hay en el proveedor con nuestras
 * asignaciones a clientes.
 *
 * El listado del proveedor se cachea unos segundos porque la API limita el
 * ritmo de peticiones y recorrerla cuesta una llamada por proyecto. El admin
 * puede forzar la relectura con el botón de refrescar.
 */

const CACHE_TTL_MS = 30_000;

type Cache = {
  /** Huella de la configuración: si cambia el token o la URL, la caché muere. */
  fingerprint: string;
  at: number;
  servers: ProviderServer[];
};

let cache: Cache | null = null;

/** Identifica la configuración sin guardar el token completo en memoria viva. */
function fingerprint(cfg: ProviderConfig): string {
  return `${cfg.apiUrl}|${cfg.token.slice(-6)}`;
}

async function fetchServers(cfg: ProviderConfig, refresh: boolean): Promise<ProviderServer[]> {
  const fp = fingerprint(cfg);
  if (!refresh && cache && cache.fingerprint === fp && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.servers;
  }
  const servers = await listAllServers(cfg);
  cache = { fingerprint: fp, at: Date.now(), servers };
  return servers;
}

/** Descarta la caché: se llama tras cambiar el token o asignar un servidor. */
export function invalidateInventoryCache(): void {
  cache = null;
}

/**
 * Configuración del proveedor lista para usar, o null si no está activo. Es el
 * único sitio donde se decide que "se puede hablar con el proveedor".
 */
export async function providerConfig(): Promise<ProviderConfig | null> {
  const { provider } = await readSettings();
  if (!provider.enabled || !provider.token) return null;
  return { apiUrl: provider.apiUrl, token: provider.token };
}

/** Listado de servidores del proveedor (cacheado). Vacío si no está activo. */
export async function providerServers(refresh = false): Promise<ProviderServer[]> {
  const cfg = await providerConfig();
  if (!cfg) return [];
  return fetchServers(cfg, refresh);
}

export type InventoryCustomer = { id: string; nombre: string; email: string };

export type InventoryItem = {
  remote: ProviderServer;
  managed: ManagedServer | null;
  cliente: InventoryCustomer | null;
};

/** Máquina sin proveedor: no hay `remote`, solo nuestra ficha y su agente. */
export type ExternalItem = {
  managed: ManagedServer;
  cliente: InventoryCustomer | null;
};

/**
 * Estado del agente de una ficha. Vale igual para un servidor del proveedor
 * —donde el agente añade la RAM, que la API no da— que para uno externo, donde
 * es la única fuente de datos que hay.
 */
export type AgentStatus = {
  /** Hay token emitido: el agente puede enviar. */
  activo: boolean;
  /** Ha enviado algo hace poco. */
  vivo: boolean;
  ultimaAt: string | null;
  hostname: string | null;
  os: string | null;
  version: string | null;
  cpu: number | null;
  memPct: number | null;
  discoPct: number | null;
};

export type Inventory = {
  /** false si aún no hay token del proveedor: la pantalla lo explica. */
  configured: boolean;
  items: InventoryItem[];
  /** Máquinas dadas de alta a mano (takehost y cualquier otro sin API). */
  externos: ExternalItem[];
  /**
   * Fichas nuestras cuyo servidor ya no aparece en el proveedor (borrado o
   * movido a otra cuenta). Se muestran para poder limpiarlas a mano.
   */
  huerfanos: ManagedServer[];
  /** Clientes a los que se puede asignar un servidor. */
  clientes: InventoryCustomer[];
  /** Estado del agente, indexado por el id interno de la ficha. */
  agentes: Record<string, AgentStatus>;
};

/**
 * Construye el inventario. Puede lanzar `ProviderError` si la API falla: quien
 * llama decide cómo contarlo (la pantalla lo muestra sin romper el resto).
 */
export async function buildInventory(refresh = false): Promise<Inventory> {
  const { provider } = await readSettings();
  const [managed, usuarios] = await Promise.all([listManagedServers(), listUsers()]);

  const clientes: InventoryCustomer[] = usuarios
    .map((u) => ({
      id: u.id,
      nombre: `${u.nombre} ${u.apellidos}`.trim() || u.email,
      email: u.email,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const porUserId = new Map(clientes.map((c) => [c.id, c]));
  const delProveedor = managed.filter((m) => m.proveedor === "v4vm");

  const externos: ExternalItem[] = managed
    .filter((m) => m.proveedor === "externo")
    .map((m) => ({ managed: m, cliente: m.userId ? (porUserId.get(m.userId) ?? null) : null }))
    .sort((a, b) => a.managed.etiqueta.localeCompare(b.managed.etiqueta));

  // El estado del agente no depende del proveedor: se calcula siempre, también
  // cuando la API está caída o ni siquiera configurada.
  const agentes = await estadoAgentes(managed);

  if (!provider.enabled || !provider.token) {
    return { configured: false, items: [], externos, huerfanos: [], clientes, agentes };
  }

  const servers = await fetchServers(
    { apiUrl: provider.apiUrl, token: provider.token },
    refresh
  );

  const porRemoteId = new Map(delProveedor.map((m) => [m.remoteId, m]));

  const items: InventoryItem[] = servers.map((remote) => {
    const ficha = porRemoteId.get(remote.id) ?? null;
    return {
      remote,
      managed: ficha,
      cliente: ficha?.userId ? (porUserId.get(ficha.userId) ?? null) : null,
    };
  });

  // Solo son huérfanas las fichas del proveedor: un externo no está en su
  // listado por definición, y marcarlo como huérfano invitaría a borrarlo.
  const vistos = new Set(servers.map((s) => s.id));
  const huerfanos = delProveedor.filter((m) => !vistos.has(m.remoteId));

  return { configured: true, items, externos, huerfanos, clientes, agentes };
}

/** Cruza las fichas con la última muestra que envió cada agente. */
async function estadoAgentes(managed: ManagedServer[]): Promise<Record<string, AgentStatus>> {
  const conAgente = managed.filter((m) => m.agenteTokenHash !== null);
  const muestras = await ultimasMuestras(conAgente.map((m) => m.id));

  const out: Record<string, AgentStatus> = {};
  for (const m of conAgente) {
    const dato = muestras.get(m.id) ?? null;
    out[m.id] = {
      activo: true,
      vivo: agenteVivo(dato?.meta ?? null),
      ultimaAt: dato?.meta?.ultimoAt ?? null,
      hostname: dato?.meta?.hostname ?? null,
      os: dato?.meta?.os ?? null,
      version: dato?.meta?.version ?? null,
      cpu: dato?.ultima.cpu ?? null,
      memPct: dato?.ultima.memPct ?? null,
      discoPct: dato?.ultima.discoPct ?? null,
    };
  }
  return out;
}
