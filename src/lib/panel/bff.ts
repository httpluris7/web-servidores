import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno, type ManagedServer } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { ProvisionerError } from "@/lib/provisioner/client";

/**
 * Guard compartido de los route handlers del panel: sesión + id válido +
 * rate-limit + pertenencia (proxmox). Vive en `lib` (no en un route.ts) porque
 * Next.js solo deja exportar handlers y config desde los ficheros de ruta.
 */
export async function panelGuard(
  ctx: { params: Promise<{ id: string }> },
  key: string,
  limit: number,
): Promise<{ ficha: ManagedServer | null; error: NextResponse | null }> {
  const session = await getSession();
  if (!session) {
    return { ficha: null, error: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }) };
  }
  const { id } = await ctx.params;
  if (!esIdInterno(id)) {
    return { ficha: null, error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  }
  const limite = rateLimit(`${key}:${session.uid}:${id}`, { limit, windowMs: 60_000 });
  if (!limite.ok) {
    return {
      ficha: null,
      error: NextResponse.json(
        { ok: false, error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
      ),
    };
  }
  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha || ficha.proveedor !== "proxmox") {
    return { ficha: null, error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  }
  return { ficha, error: null };
}

/** Respuesta 502 uniforme ante un fallo del provisioner (con log del detalle). */
export function falloProvisioner(contexto: string, err: unknown): NextResponse {
  const status = err instanceof ProvisionerError ? err.status : undefined;
  console.error(
    "[panel] fallo en",
    contexto,
    err instanceof ProvisionerError ? `${status ?? ""} ${err.message}` : err,
  );
  if (status === 409) return NextResponse.json({ ok: false, error: "busy" }, { status: 409 });
  return NextResponse.json({ ok: false, error: "Could not reach the provisioner." }, { status: 502 });
}
