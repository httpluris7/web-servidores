import type { Producto } from "@/lib/catalogo/store";
import type { PlanProvisioner } from "./client";

/**
 * Traducción de un producto del catálogo (texto libre de specs) a un plan del
 * provisioner. Módulo puro (sin `server-only`) para poder probarlo.
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

