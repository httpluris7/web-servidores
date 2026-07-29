import { readSettings } from "@/lib/ajustes";
import { listUsers } from "@/lib/auth";
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

export type InventoryCustomer = { id: string; nombre: string; email: string };

export type InventoryItem = {
  remote: ProviderServer;
  managed: ManagedServer | null;
  cliente: InventoryCustomer | null;
};

export type Inventory = {
  /** false si aún no hay token del proveedor: la pantalla lo explica. */
  configured: boolean;
  items: InventoryItem[];
  /**
   * Fichas nuestras cuyo servidor ya no aparece en el proveedor (borrado o
   * movido a otra cuenta). Se muestran para poder limpiarlas a mano.
   */
  huerfanos: ManagedServer[];
  /** Clientes a los que se puede asignar un servidor. */
  clientes: InventoryCustomer[];
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

  if (!provider.enabled || !provider.token) {
    return { configured: false, items: [], huerfanos: [], clientes };
  }

  const servers = await fetchServers({ apiUrl: provider.apiUrl, token: provider.token }, refresh);

  const porRemoteId = new Map(managed.map((m) => [m.remoteId, m]));
  const porUserId = new Map(clientes.map((c) => [c.id, c]));

  const items: InventoryItem[] = servers.map((remote) => {
    const ficha = porRemoteId.get(remote.id) ?? null;
    return {
      remote,
      managed: ficha,
      cliente: ficha?.userId ? (porUserId.get(ficha.userId) ?? null) : null,
    };
  });

  const vistos = new Set(servers.map((s) => s.id));
  const huerfanos = managed.filter((m) => !vistos.has(m.remoteId));

  return { configured: true, items, huerfanos, clientes };
}
