import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { getServerForUser } from "@/lib/servidores/cliente";
import {
  createSnapshot,
  deleteSnapshot,
  listOsOptions,
  listProjectSshKeys,
  listSnapshots,
  openVncConsole,
  ProviderError,
  reinstallServer,
  resetRootPassword,
  restartServer,
  revertSnapshot,
  startServer,
  stopServer,
} from "@/lib/servidores/v4vm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Acciones del cliente sobre su servidor.
 *
 * Una sola ruta para todas: así el control de pertenencia
 * (`getServerForUser`) se hace en un único sitio y no hay forma de añadir una
 * acción nueva y olvidarse de comprobarlo.
 *
 * Lo que NO está aquí, a propósito:
 *  - Borrar el servidor: es irreversible y no debe estar a un clic. Pasa por
 *    soporte.
 *  - Redimensionar, discos e IPs adicionales: cambian lo que se factura.
 *  - Cambiar de proyecto o de propietario: son operaciones nuestras.
 */

/** Acciones que consumen recursos del proveedor y conviene limitar. */
const ACCIONES = [
  "encender",
  "apagar",
  "reiniciar",
  "consola",
  "password",
  "reinstalar",
  "opciones",
  "snapshot-crear",
  "snapshot-revertir",
  "snapshot-borrar",
] as const;
type Accion = (typeof ACCIONES)[number];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const accion = body.accion as Accion;
  if (!ACCIONES.includes(accion)) {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 422 });
  }

  // Cada acción golpea la API del proveedor, que limita el ritmo. El tope va
  // por usuario y servidor, no por IP: un cliente impaciente no debe poder
  // dejar sin cuota a los demás.
  const limite = rateLimit(`srv:${session.uid}:${id}`, { limit: 20, windowMs: 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests.", retryAfter: limite.retryAfter },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } }
    );
  }

  const found = await getServerForUser(id, session.uid);
  if (!found) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const { cfg, remote } = found;
  const remoteId = found.managed.remoteId;

  // Una tarea en curso deja el servidor bloqueado en el proveedor: mejor
  // decirlo aquí que dejar que responda con un error genérico.
  const mutantes: Accion[] = [
    "encender",
    "apagar",
    "reiniciar",
    "reinstalar",
    "password",
    "snapshot-crear",
    "snapshot-revertir",
  ];
  if (remote.isProcessing && mutantes.includes(accion)) {
    return NextResponse.json({ ok: false, error: "busy" }, { status: 409 });
  }
  if (remote.isSuspended && mutantes.includes(accion)) {
    return NextResponse.json({ ok: false, error: "suspended" }, { status: 409 });
  }

  try {
    switch (accion) {
      case "encender":
        await startServer(cfg, remoteId);
        return NextResponse.json({ ok: true });

      case "apagar":
        await stopServer(cfg, remoteId, body.force === true);
        return NextResponse.json({ ok: true });

      case "reiniciar":
        await restartServer(cfg, remoteId, body.force === true);
        return NextResponse.json({ ok: true });

      case "consola": {
        const url = await openVncConsole(cfg, remoteId);
        if (!url) {
          return NextResponse.json({ ok: false, error: "console_unavailable" }, { status: 502 });
        }
        return NextResponse.json({ ok: true, url });
      }

      case "password": {
        // Se devuelve una sola vez y no se guarda en ninguna parte.
        const password = await resetRootPassword(cfg, remoteId);
        if (!password) {
          return NextResponse.json({ ok: false, error: "password_unavailable" }, { status: 502 });
        }
        return NextResponse.json({ ok: true, password });
      }

      case "opciones": {
        // Catálogo para el formulario de reinstalación.
        const [sistemas, claves] = await Promise.all([
          listOsOptions(cfg),
          remote.projectId ? listProjectSshKeys(cfg, remote.projectId) : Promise.resolve([]),
        ]);
        return NextResponse.json({ ok: true, sistemas, claves });
      }

      case "reinstalar": {
        const osVersionId = Number(body.os);
        if (!Number.isInteger(osVersionId) || osVersionId <= 0) {
          return NextResponse.json({ ok: false, error: "Invalid OS." }, { status: 422 });
        }
        // Confirmación explícita: el cliente teclea el nombre del servidor.
        // Reinstalar borra todos los datos, así que no basta con un botón.
        if (typeof body.confirmacion !== "string" || body.confirmacion.trim() !== remote.name) {
          return NextResponse.json({ ok: false, error: "confirmation_mismatch" }, { status: 422 });
        }
        const sshKeyIds = Array.isArray(body.sshKeys)
          ? body.sshKeys.map(Number).filter((n) => Number.isInteger(n) && n > 0)
          : [];
        await reinstallServer(cfg, remoteId, { osVersionId, sshKeyIds });
        return NextResponse.json({ ok: true });
      }

      case "snapshot-crear": {
        const nombre =
          typeof body.nombre === "string" && body.nombre.trim()
            ? body.nombre.trim().slice(0, 255)
            : `snapshot-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}`;
        await createSnapshot(cfg, remoteId, nombre);
        return NextResponse.json({ ok: true });
      }

      case "snapshot-revertir":
      case "snapshot-borrar": {
        const snapshotId = Number(body.snapshotId);
        if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
          return NextResponse.json({ ok: false, error: "Invalid snapshot." }, { status: 422 });
        }
        // La instantánea tiene que ser DE ESTE servidor: su id va suelto en la
        // API del proveedor, así que sin esta comprobación un cliente podría
        // revertir la instantánea de otro probando números.
        const propias = await listSnapshots(cfg, remoteId);
        if (!propias.some((s) => s.id === snapshotId)) {
          return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
        }
        if (accion === "snapshot-revertir") await revertSnapshot(cfg, snapshotId);
        else await deleteSnapshot(cfg, snapshotId);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    if (err instanceof ProviderError) {
      const suffix = err.retryAfter ? ` Try again in ${err.retryAfter}s.` : "";
      return NextResponse.json({ ok: false, error: err.message + suffix }, { status: 502 });
    }
    return NextResponse.json(
      { ok: false, error: "Could not reach the provider." },
      { status: 502 }
    );
  }
}
