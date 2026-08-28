/**
 * Sistemas operativos ofrecibles al contratar un VPS de nuestro Proxmox.
 *
 * Son los `os_slug` registrados como plantilla en el provisioner (una plantilla
 * cloud-init por SO en cada ubicación). Esta lista es la ÚNICA fuente de verdad
 * del selector del checkout y de la validación en `/api/pedidos`: un slug que no
 * esté aquí no se acepta, para no encolar una provisión que el worker no sabría
 * resolver. Si se añade una plantilla nueva en el provisioner, se añade aquí.
 */

export type OsOption = { slug: string; label: string };

export const OS_OPTIONS: readonly OsOption[] = [
  { slug: "ubuntu-24.04", label: "Ubuntu 24.04 LTS" },
  { slug: "ubuntu-22.04", label: "Ubuntu 22.04 LTS" },
  { slug: "debian-12", label: "Debian 12" },
  { slug: "debian-13", label: "Debian 13" },
  { slug: "rocky-9", label: "Rocky Linux 9" },
  { slug: "almalinux-9", label: "AlmaLinux 9" },
] as const;

/** SO por defecto si el cliente no elige otro. */
export const OS_DEFAULT = "ubuntu-24.04";

const SLUGS = new Set(OS_OPTIONS.map((o) => o.slug));

/** ¿Es un SO que sabemos aprovisionar? */
export function isKnownOs(slug: string): boolean {
  return SLUGS.has(slug);
}

/** Etiqueta legible de un SO, o el propio slug si no se conoce. */
export function osLabel(slug: string): string {
  return OS_OPTIONS.find((o) => o.slug === slug)?.label ?? slug;
}
