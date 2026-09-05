import "server-only";
import type { Catalogo, Producto } from "@/lib/catalogo/store";
import { isConfigured, syncPlans, type PlanProvisioner, type PlanSyncResult } from "./client";

/**
 * Sincronización catálogo web → provisioner.
 *
 * El disco, la RAM, los vCores y el precio de cada plan VPS viven en dos sitios:
 * `data/catalogo.json` (lo que se vende) y la tabla `plans` del provisioner (lo
 * que se crea en Proxmox). Manda la web: cada vez que el admin guarda un
 * producto VPS se empuja su definición al provisioner, y desde /admin/catalogo
 * se puede forzar una sincronización completa para detectar desvíos.
 *
 * Las specs del catálogo son texto libre para el escaparate ("120 GB NVMe Gen4",
 * "8 GB DDR4", "4 vCore AMD EPYC"); se toma el primer número con su unidad.
 * Si alguna no se puede interpretar, el plan se deja fuera y se informa, para
 * no mandar nunca un valor inventado a Proxmox.
 */

export { derivarPlan, type PlanDerivado } from "./planes-parse";
import { derivarPlan } from "./planes-parse";

/** Productos que el provisioner debe conocer: los de categorías de tipo `vps`. */
export function productosVps(catalogo: Catalogo): Producto[] {
  const vps = new Set(catalogo.categorias.filter((c) => c.tipo === "vps").map((c) => c.id));
  return catalogo.productos.filter((p) => vps.has(p.categoriaId));
}

export type InformeSync = {
  ok: boolean;
  /** `null` si el provisioner no está configurado en este entorno. */
  resultado: PlanSyncResult | null;
  /** Productos que no se pudieron traducir a un plan (texto de specs no interpretable). */
  noInterpretables: Array<{ planId: string; motivo: "cpu" | "ram" | "disco" | "precio" }>;
  error: string | null;
};

/**
 * Empuja al provisioner los productos VPS indicados (o todos). Nunca lanza:
 * el catálogo ya está guardado y el error se muestra al admin.
 */
export async function sincronizarConProvisioner(
  catalogo: Catalogo,
  soloPlanIds?: string[],
): Promise<InformeSync> {
  const filtro = soloPlanIds ? new Set(soloPlanIds) : null;
  const candidatos = productosVps(catalogo).filter((p) => !filtro || filtro.has(p.planId));
  const noInterpretables: InformeSync["noInterpretables"] = [];
  const planes: PlanProvisioner[] = [];
  for (const p of candidatos) {
    const d = derivarPlan(p);
    if (d.ok) planes.push(d.plan);
    else noInterpretables.push({ planId: d.planId, motivo: d.motivo });
  }
  if (!isConfigured()) return { ok: true, resultado: null, noInterpretables, error: null };
  if (planes.length === 0) {
    return { ok: true, resultado: { ok: true, actualizados: [], sinCambios: [], desconocidos: [] }, noInterpretables, error: null };
  }
  try {
    const resultado = await syncPlans(planes);
    return { ok: true, resultado, noInterpretables, error: null };
  } catch (err) {
    console.error("[catalogo] sincronización con el provisioner fallida:", err);
    return { ok: false, resultado: null, noInterpretables, error: err instanceof Error ? err.message : String(err) };
  }
}
