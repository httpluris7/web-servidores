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

export type PlanDerivado =
  | { ok: true; plan: PlanProvisioner }
  | { ok: false; planId: string; motivo: "cpu" | "ram" | "disco" | "precio" };

/** Primer número seguido de una unidad de capacidad; devuelve MB. */
function capacidadMb(texto: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)\b/i.exec(texto);
  if (!m || !m[1] || !m[2]) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = m[2].toUpperCase();
  return Math.round(n * (u === "TB" ? 1024 * 1024 : u === "GB" ? 1024 : 1));
}

function vcores(texto: string): number | null {
  const m = /(\d+)\s*(?:v?cores?|vcpus?|núcleos?|nucleos?|hilos?|threads?|cpus?)\b/i.exec(texto) ?? /^\s*(\d+)\b/.exec(texto);
  if (!m || !m[1]) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function derivarPlan(producto: Producto): PlanDerivado {
  const cpu = vcores(producto.cpu);
  if (cpu === null) return { ok: false, planId: producto.planId, motivo: "cpu" };
  const ramMb = capacidadMb(producto.ram);
  if (ramMb === null) return { ok: false, planId: producto.planId, motivo: "ram" };
  const discoMb = capacidadMb(producto.almacenamiento);
  if (discoMb === null || discoMb < 1024) return { ok: false, planId: producto.planId, motivo: "disco" };
  const precio = Math.round(producto.precio * 100);
  if (!Number.isFinite(precio) || precio < 0) return { ok: false, planId: producto.planId, motivo: "precio" };
  return {
    ok: true,
    plan: { slug: producto.planId, vcores: cpu, ramMb, discoGb: Math.round(discoMb / 1024), precioMesEur: precio },
  };
}

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
