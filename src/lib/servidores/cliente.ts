import { providerConfig, providerServers } from "./inventario";
import {
  assignServer,
  getManagedById,
  issueAgentToken,
  listManagedByUser,
  marcarAutoIntentoAgente,
  revokeAgentToken,
  type ManagedServer,
} from "./store";
import { getServer, type ProviderConfig, type ProviderServer } from "./v4vm";
import { proxmoxRemote } from "./proxmox-view";
import { getOrder, installAgent } from "@/lib/provisioner/client";
import { osFamilia } from "@/lib/provisioner/os";
import { pendientesDeFicha, marcarFichaCreada } from "@/lib/provisioner/intents";

/**
 * Instala el agente de métricas dentro de un VPS recién aprovisionado, en segundo
 * plano y UNA sola vez, para que el cliente vea las gráficas (CPU/RAM/red/disco)
 * sin tener que hacer nada. Solo Linux: el agente lee `/proc`, en Windows no hay
 * equivalente. No se espera: no debe añadir latencia a la página (el servidor de
 * la web es de larga vida, pm2, así que la promesa suelta continúa).
 */
async function autoinstalarAgente(fichaId: string, vpsId: number, osSlug: string): Promise<void> {
  if (osFamilia(osSlug) !== "linux") return;
  // Reclamar el intento de forma atómica: si otro acceso concurrente ya lo tomó,
  // no repetir (evita instalar dos veces y rotar el token sin querer).
  const reclamado = await marcarAutoIntentoAgente(fichaId);
  if (!reclamado) return;
  const token = await issueAgentToken(fichaId);
  if (!token) return;
  try {
    await installAgent(vpsId, token);
  } catch (err) {
    // No se pudo instalar: revocar el token para no dejar la ficha con "agente
    // activo" pero sin datos. Queda el flujo manual del panel como respaldo.
    await revokeAgentToken(fichaId).catch(() => {});
    console.error("[servidores] auto-instalación del agente falló", vpsId, err);
  }
}

/**
 * Reconciliación perezosa de los VPS aprovisionados al pagar.
 *
 * El aprovisionamiento se dispara en el webhook, que solo conoce el `order_id`;
 * el `vps_id` (necesario para dar de alta la ficha del servidor) no existe hasta
 * unos segundos después, cuando el worker crea la máquina. En vez de sondear en
 * segundo plano, resolvemos ese hueco aquí, cuando el cliente entra en su área:
 * por cada provisión suya aún sin ficha, preguntamos el estado del pedido y, si
 * ya está `active`, creamos la ficha `proxmox`. Es idempotente (la creación de
 * ficha lo es) y tolerante a fallos (si el provisioner no responde, se reintenta
 * la próxima vez). Nunca lanza.
 */
async function reconciliarFichasProxmox(userId: string): Promise<void> {
  let pendientes;
  try {
    pendientes = await pendientesDeFicha(userId);
  } catch {
    return;
  }
  for (const it of pendientes) {
    if (it.provisionOrderId == null) continue;
    try {
      const order = await getOrder(it.provisionOrderId);
      if (order.estado === "active" && order.vps_id != null) {
        const ficha = await assignServer({
          proveedor: "proxmox",
          remoteId: order.vps_id,
          remoteUuid: "",
          userId,
          etiqueta: it.hostname ?? "",
        });
        await marcarFichaCreada(it.invoiceId, it.planSlug);
        // Recién dada de alta la ficha: instalar el agente de métricas en segundo
        // plano, una sola vez (Linux). No se espera para no frenar la página.
        if (ficha.agenteAutoAt == null) {
          void autoinstalarAgente(ficha.id, order.vps_id, order.os);
        }
      } else if (order.estado === "failed" || order.estado === "cancelled") {
        // No habrá máquina: se cierra la intención para no reintentar sin fin.
        await marcarFichaCreada(it.invoiceId, it.planSlug);
      }
      // queued/provisioning: se deja pendiente; aparecerá en el próximo acceso.
    } catch (err) {
      console.error(
        "[servidores] reconciliación proxmox falló para el pedido",
        it.provisionOrderId,
        err,
      );
    }
  }
}

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
 * Servidor de Proxmox de un cliente, con su estado leído del provisioner,
 * adaptado a `ProviderServer`. null si no existe, no es suyo, no es proxmox, o
 * el provisioner no responde. Es el equivalente a `getServerForUser` para los
 * VPS de nuestro propio Proxmox.
 */
export async function getProxmoxServerForUser(
  id: string,
  userId: string,
): Promise<{ managed: ManagedServer; remote: ProviderServer } | null> {
  // Puede que la ficha aún no exista (VPS recién pagado): se intenta crear.
  await reconciliarFichasProxmox(userId);
  const managed = await getManagedForUser(id, userId);
  if (!managed || managed.proveedor !== "proxmox") return null;
  const remote = await proxmoxRemote(managed);
  if (!remote) return null;
  return { managed, remote };
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
  // Da de alta la ficha de los VPS recién aprovisionados que ya estén listos,
  // para que aparezcan en el listado sin esperar a nada más.
  await reconciliarFichasProxmox(userId);

  const managed = await listManagedByUser(userId);
  if (managed.length === 0) return [];

  // Solo se pregunta al proveedor si el cliente tiene alguna máquina suya: con
  // un cliente de puros externos, la API ni se toca.
  const hayDelProveedor = managed.some((m) => m.proveedor === "v4vm");
  const servers = hayDelProveedor ? await providerServers() : [];
  const porId = new Map(servers.map((s) => [s.id, s]));

  // Los VPS de Proxmox se preguntan uno a uno al provisioner (son pocos y su
  // API es local), en paralelo y tolerante a fallos.
  const resueltos = await Promise.all(
    managed.map(async (m): Promise<ClientServer | null> => {
      if (m.proveedor === "externo") return { managed: m, remote: null };
      if (m.proveedor === "proxmox") {
        const remote = await proxmoxRemote(m);
        return remote ? { managed: m, remote } : null;
      }
      const remote = porId.get(m.remoteId);
      // Ficha huérfana (el servidor ya no está en el proveedor), o un id que ya
      // no corresponde a la máquina asignada: se omite. El admin las ve en su
      // inventario para poder limpiarlas.
      return remote && mismoServidor(m, remote) ? { managed: m, remote } : null;
    }),
  );
  return resueltos
    .filter((x): x is ClientServer => x !== null)
    .sort((a, b) => nombre(a).localeCompare(nombre(b)));
}

function nombre(s: ClientServer): string {
  return s.managed.etiqueta || s.remote?.name || "";
}
