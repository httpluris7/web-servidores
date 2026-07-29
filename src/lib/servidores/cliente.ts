import { providerConfig, providerServers } from "./inventario";
import { getManagedById, listManagedByUser, type ManagedServer } from "./store";
import { getServer, type ProviderConfig, type ProviderServer } from "./v4vm";

/**
 * Acceso del CLIENTE a sus servidores.
 *
 * Todo lo que el área de cliente hace con un servidor —verlo, encenderlo,
 * reinstalarlo— pasa por `getServerForUser`. Es el único punto donde se
 * comprueba la pertenencia, igual que `getInvoiceForUser` con las facturas: si
 * la comprobación estuviera repartida por cada pantalla y cada ruta, tarde o
 * temprano se olvidaría en una.
 *
 * Un servidor ajeno se trata como inexistente (null → 404), para no revelar
 * qué servidores hay en el sistema.
 */

export type ClientServer = {
  managed: ManagedServer;
  remote: ProviderServer;
};

/**
 * Servidor de un cliente, con su estado recién leído del proveedor.
 *
 * Devuelve null si: no existe la ficha, no es de este usuario, el proveedor no
 * está configurado, o el servidor ya no existe en el proveedor.
 */
export async function getServerForUser(
  id: string,
  userId: string
): Promise<(ClientServer & { cfg: ProviderConfig }) | null> {
  const managed = await getManagedById(id);
  if (!managed || !managed.userId || managed.userId !== userId) return null;

  const cfg = await providerConfig();
  if (!cfg) return null;

  // Sin caché: quien va a actuar sobre el servidor necesita su estado real.
  const remote = await getServer(cfg, managed.remoteId);
  if (!remote) return null;

  return { managed, remote, cfg };
}

/**
 * Servidores de un cliente para el listado. Usa el listado cacheado del
 * proveedor —una llamada por proyecto— en vez de pedir uno a uno.
 */
export async function listServersForUser(userId: string): Promise<ClientServer[]> {
  const managed = await listManagedByUser(userId);
  if (managed.length === 0) return [];

  const servers = await providerServers();
  const porId = new Map(servers.map((s) => [s.id, s]));

  return managed
    .map((m) => {
      const remote = porId.get(m.remoteId);
      // Ficha huérfana (el servidor ya no está en el proveedor): se omite. El
      // admin las ve en su inventario para poder limpiarlas.
      return remote ? { managed: m, remote } : null;
    })
    .filter((x): x is ClientServer => x !== null)
    .sort((a, b) => a.remote.name.localeCompare(b.remote.name));
}
