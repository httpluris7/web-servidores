import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { esRango, leerMetricas } from "@/lib/servidores/metricas";
import { getManagedById } from "@/lib/servidores/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serie de métricas de cualquier servidor del inventario. Solo admin. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  const { id } = await params;
  const ficha = await getManagedById(id);
  if (!ficha) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const pedido = new URL(req.url).searchParams.get("rango");
  const rango = esRango(pedido) ? pedido : "24h";

  const serie = await leerMetricas(id, rango);
  return NextResponse.json({
    ok: true,
    rango,
    agenteActivo: ficha.agenteTokenHash !== null,
    ...serie,
  });
}
