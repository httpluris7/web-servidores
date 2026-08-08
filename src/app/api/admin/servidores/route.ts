import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { readSettings } from "@/lib/ajustes";
import { listUsers } from "@/lib/auth";
import { olvidarAvisos } from "@/lib/servidores/avisos";
import { buildInventory, invalidateInventoryCache } from "@/lib/servidores/inventario";
import { borrarMetricas } from "@/lib/servidores/metricas";
import {
  assignServer,
  createExternalServer,
  deleteManaged,
  esIdInterno,
  forgetServer,
  getManagedById,
  issueAgentToken,
  revokeAgentToken,
  updateManaged,
} from "@/lib/servidores/store";
import { getServer, ProviderError } from "@/lib/servidores/v4vm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Traduce un fallo del proveedor a una respuesta presentable. Siempre 502:
 * desde el punto de vista del panel el problema está aguas arriba, incluso
 * cuando el proveedor responde 401 (ahí el token nuestro es el que falla).
 */
function providerFailure(err: unknown) {
  const message =
    err instanceof ProviderError
      ? err.message + (err.retryAfter ? ` Try again in ${err.retryAfter}s.` : "")
      : "Could not reach the provider.";
  return NextResponse.json({ ok: false, error: message }, { status: 502 });
}

/** Inventario completo: servidores del proveedor cruzados con nuestros clientes. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    return NextResponse.json({ ok: true, ...(await buildInventory(refresh)) });
  } catch (err) {
    return providerFailure(err);
  }
}

/**
 * Asigna un servidor a un cliente, lo desasigna (`userId: null`) o borra su
 * ficha (`action: "forget"`). Nada de esto toca el servidor en el proveedor:
 * solo cambia a quién se lo mostramos en el área de cliente.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  // Acciones que trabajan sobre NUESTRA ficha (id interno) y no tocan la API
  // del proveedor: alta de máquinas externas y gestión del token del agente.
  const accion = typeof body.action === "string" ? body.action : "";
  if (accion === "crear-externo" || accion === "editar" || accion === "borrar" ||
      accion === "token" || accion === "revocar-token") {
    return fichaPropia(accion, body);
  }

  const remoteId = Number(body.remoteId);
  if (!Number.isInteger(remoteId) || remoteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid server id." }, { status: 422 });
  }

  if (body.action === "forget") {
    await forgetServer("v4vm", remoteId);
    return NextResponse.json({ ok: true });
  }

  // null desasigna; una cadena tiene que corresponder a un cliente existente.
  const userId = body.userId === null || body.userId === "" ? null : body.userId;
  if (userId !== null && typeof userId !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid customer." }, { status: 422 });
  }
  if (userId !== null) {
    const users = await listUsers();
    if (!users.some((u) => u.id === userId)) {
      return NextResponse.json({ ok: false, error: "Unknown customer." }, { status: 422 });
    }
  }

  const { provider } = await readSettings();
  if (!provider.enabled || !provider.token) {
    return NextResponse.json({ ok: false, error: "The provider is not configured." }, { status: 409 });
  }

  // Comprobamos contra el proveedor que el servidor existe y que nuestro token
  // lo ve, para no dejar en el inventario una ficha que no apunta a nada.
  let remote;
  try {
    remote = await getServer({ apiUrl: provider.apiUrl, token: provider.token }, remoteId);
  } catch (err) {
    return providerFailure(err);
  }
  if (!remote) {
    return NextResponse.json({ ok: false, error: "That server is not in your account." }, { status: 404 });
  }

  const etiqueta = typeof body.etiqueta === "string" ? body.etiqueta : undefined;
  const notas = typeof body.notas === "string" ? body.notas : undefined;

  const managed = await assignServer({
    proveedor: "v4vm",
    remoteId,
    remoteUuid: remote.uuid,
    userId,
    // Sin etiqueta propia, hereda el nombre que tiene en el proveedor.
    etiqueta: etiqueta ?? remote.name,
    notas,
  });

  // El estado del servidor puede haber cambiado desde la última lectura.
  invalidateInventoryCache();

  return NextResponse.json({ ok: true, managed });
}

/* ------------------- Fichas propias: externos y agente -------------------- */

/** null si no se indicó cliente; `false` si el indicado no existe. */
async function resolverCliente(valor: unknown): Promise<string | null | false> {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor !== "string") return false;
  const users = await listUsers();
  return users.some((u) => u.id === valor) ? valor : false;
}

const cadena = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Alta y mantenimiento de las máquinas que llevamos solo nosotros, y del token
 * con el que su agente envía métricas.
 *
 * El token se devuelve en claro UNA sola vez, aquí: a partir de este momento
 * solo queda su hash y no hay forma de recuperarlo, únicamente de regenerarlo.
 */
async function fichaPropia(accion: string, body: Record<string, unknown>) {
  if (accion === "crear-externo") {
    const etiqueta = cadena(body.etiqueta, 80);
    if (!etiqueta) {
      return NextResponse.json({ ok: false, error: "A name is required." }, { status: 422 });
    }
    const userId = await resolverCliente(body.userId);
    if (userId === false) {
      return NextResponse.json({ ok: false, error: "Unknown customer." }, { status: 422 });
    }

    const managed = await createExternalServer({
      etiqueta,
      host: cadena(body.host, 120),
      userId,
      notas: cadena(body.notas, 500),
    });
    // Se emite el token en el alta: una máquina externa sin agente no muestra
    // absolutamente nada, así que dar de alta y no dar token no sirve de nada.
    const token = await issueAgentToken(managed.id);
    return NextResponse.json({ ok: true, managed, token });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!esIdInterno(id)) {
    return NextResponse.json({ ok: false, error: "Invalid server id." }, { status: 422 });
  }
  const ficha = await getManagedById(id);
  if (!ficha) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  if (accion === "editar") {
    const parche: Parameters<typeof updateManaged>[1] = {};
    if (body.etiqueta !== undefined) parche.etiqueta = cadena(body.etiqueta, 80);
    if (body.host !== undefined) parche.host = cadena(body.host, 120);
    if (body.notas !== undefined) parche.notas = cadena(body.notas, 500);
    if (body.userId !== undefined) {
      const userId = await resolverCliente(body.userId);
      if (userId === false) {
        return NextResponse.json({ ok: false, error: "Unknown customer." }, { status: 422 });
      }
      parche.userId = userId;
    }
    return NextResponse.json({ ok: true, managed: await updateManaged(id, parche) });
  }

  if (accion === "borrar") {
    // Solo se borran las fichas externas: las del proveedor se quitan con
    // "forget", que es la vía que ya existe y no deja el inventario a medias.
    if (ficha.proveedor !== "externo") {
      return NextResponse.json(
        { ok: false, error: "Only external servers can be deleted here." },
        { status: 409 }
      );
    }
    await deleteManaged(id);
    // El histórico y los avisos se van con la ficha: si no, quedarían ocupando
    // disco para siempre sin nada que los enseñe, y un aviso abierto de un
    // servidor que ya no existe no podría cerrarse nunca.
    await borrarMetricas(id);
    await olvidarAvisos(id);
    return NextResponse.json({ ok: true });
  }

  if (accion === "token") {
    return NextResponse.json({ ok: true, token: await issueAgentToken(id) });
  }

  await revokeAgentToken(id);
  // Sin token no volverán a llegar muestras, así que un aviso abierto se
  // quedaría colgado esperando una recuperación que no puede llegar.
  await olvidarAvisos(id);
  return NextResponse.json({ ok: true });
}
