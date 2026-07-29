import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { readSettings } from "@/lib/ajustes";
import { listUsers } from "@/lib/auth";
import { buildInventory, invalidateInventoryCache } from "@/lib/servidores/inventario";
import { assignServer, forgetServer } from "@/lib/servidores/store";
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
