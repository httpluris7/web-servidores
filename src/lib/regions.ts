import type { Region } from "@/data/products";

/**
 * Región VPS por defecto: la primera CONECTADA a un Proxmox (`provisionLocation`),
 * y si ninguna lo está, la primera de la lista.
 *
 * Por qué: desde que el VPS se aprovisiona solo, la región elige el Proxmox. Caer
 * por defecto en `regions[0]` (p. ej. Francia, sin backend) deja el pedido pagado
 * sin máquina. Preseleccionar una región provisionable evita ese agujero.
 */
export function defaultVpsRegionSlug(regions: Region[]): string {
  return regions.find((r) => r.provisionLocation)?.slug ?? regions[0]?.slug ?? "";
}
