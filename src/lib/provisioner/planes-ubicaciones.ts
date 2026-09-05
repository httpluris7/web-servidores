import type { Producto, Ubicacion } from "@/lib/catalogo/store";

/**
 * Ubicaciones del provisioner (slugs de `locations`) donde un plan VPS es
 * contratable. Misma regla que el escaparate (`regionsForPlan`): un plan
 * exclusivo de una región, solo en ella; un plan global, en toda región que
 * NO tenga gama propia. Solo cuentan las regiones con `provisionLocation`
 * (las demás se venden y entregan a mano). Se incluyen las regiones ocultas:
 * una región en preparación necesita disponibilidad para poder probarla.
 * Módulo puro (sin `server-only`) para poder probarlo.
 */
export function ubicacionesDePlan(
  producto: Pick<Producto, "ubicacionSlug">,
  productosVps: Array<Pick<Producto, "ubicacionSlug">>,
  ubicaciones: Array<Pick<Ubicacion, "slug" | "provisionLocation">>,
): string[] {
  const conProvisioner = ubicaciones.filter((u) => u.provisionLocation.trim() !== "");
  const propias = new Set(productosVps.map((p) => p.ubicacionSlug).filter((s): s is string => !!s));
  const regiones = producto.ubicacionSlug
    ? conProvisioner.filter((u) => u.slug === producto.ubicacionSlug)
    : conProvisioner.filter((u) => !propias.has(u.slug));
  return [...new Set(regiones.map((u) => u.provisionLocation.trim()))];
}
