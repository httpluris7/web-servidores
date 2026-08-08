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
  /** null en las máquinas externas: no hay proveedor al que preguntarle. */
  remote: ProviderServer | null;
};

/**
 * Ficha de un servidor del cliente SIN hablar con el proveedor.
 *
 * Es la comprobación de pertenencia que usan las métricas: los datos vienen de
 * nuestro propio almacén, así que pedirle el estado al proveedor sería una
 * llamada de red para nada — y dejaría sin gráficas a las máquinas externas,
 * que no tienen proveedor al que preguntar.
 */
export async function getManagedForUser(
  id: string,
  userId: string
): Promise<ManagedServer | null> {
  const managed = await getManagedById(id);
  if (!managed || !managed.userId || managed.userId !== userId) return null;
  return managed;
}

/**
 * Servidor de un cliente, con su estado recién leído del proveedor.
 *
 * Devuelve null si: no existe la ficha, no es de este usuario, el proveedor no
 * está configurado, o el servidor ya no existe en el proveedor.
 */
export async function getServerForUser(
  id: string,
  userId: string
): Promise<({ managed: ManagedServer; remote: ProviderServer; cfg: ProviderConfig }) | null> {
  const managed = await getManagedForUser(id, userId);
  // Una máquina externa no tiene proveedor: aquí no hay nada que devolver, y
  // quien llama (energía, consola, reinstalación) no puede hacer nada con ella.
  if (!managed || managed.proveedor !== "v4vm") return null;

  const cfg = await providerConfig();
  if (!cfg) return null;

  // Sin caché: quien va a actuar sobre el servidor necesita su estado real.
  const remote = await getServer(cfg, managed.remoteId);
  if (!remote) return null;
  if (!mismoServidor(managed, remote)) return null;

  return { managed, remote, cfg };
}

/**
 * ¿El servidor que devuelve el proveedor es el mismo que asignamos?
 *
 * La ficha guarda el UUID justamente para esto. El id numérico es del
 * proveedor: si borra un servidor y reutiliza el número —o si lo movemos de
 * cuenta—, nuestra ficha seguiría apuntando a ese id y le daríamos a un cliente
 * el mando de una máquina que ya no es suya. El UUID no se reutiliza, así que
 * un desajuste significa "no es este servidor" y se trata como inexistente.
 *
 * Las fichas antiguas pueden no tener UUID guardado; en ese caso no hay nada
 * que comparar y se deja pasar (el id sigue siendo el criterio).
 */
function mismoServidor(managed: ManagedServer, remote: ProviderServer): boolean {
  if (!managed.remoteUuid || !remote.uuid) return true;
  return managed.remoteUuid === remote.uuid;
}

/**
 * Servidores de un cliente para el listado. Usa el listado cacheado del
 * proveedor —una llamada por proyecto— en vez de pedir uno a uno.
 */
export async function listServersForUser(userId: string): Promise<ClientServer[]> {
  const managed = await listManagedByUser(userId);
  if (managed.length === 0) return [];

  // Solo se pregunta al proveedor si el cliente tiene alguna máquina suya: con
  // un cliente de puros externos, la API ni se toca.
  const hayDelProveedor = managed.some((m) => m.proveedor === "v4vm");
  const servers = hayDelProveedor ? await providerServers() : [];
  const porId = new Map(servers.map((s) => [s.id, s]));

  return managed
    .map((m): ClientServer | null => {
      if (m.proveedor === "externo") return { managed: m, remote: null };
      const remote = porId.get(m.remoteId);
      // Ficha huérfana (el servidor ya no está en el proveedor), o un id que ya
      // no corresponde a la máquina asignada: se omite. El admin las ve en su
      // inventario para poder limpiarlas.
      return remote && mismoServidor(m, remote) ? { managed: m, remote } : null;
    })
    .filter((x): x is ClientServer => x !== null)
    .sort((a, b) => nombre(a).localeCompare(nombre(b)));
}

function nombre(s: ClientServer): string {
  return s.managed.etiqueta || s.remote?.name || "";
}
