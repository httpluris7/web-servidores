import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { readCatalogo } from "@/lib/catalogo/store";
import { sincronizarConProvisioner } from "@/lib/provisioner/planes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sincronización completa catálogo → provisioner (botón de /admin/catalogo).
 * Devuelve qué planes cambiaron, cuáles ya estaban iguales y cuáles no existen
 * en el provisioner, para detectar desvíos sin entrar en la base de datos.
 */
export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "no-autorizado" }, { status: 401 });
  const informe = await sincronizarConProvisioner(await readCatalogo());
  return NextResponse.json(informe, { status: informe.ok ? 200 : 502 });
}
