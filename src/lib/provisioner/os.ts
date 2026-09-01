/**
 * Sistemas operativos ofrecibles al contratar o reinstalar un VPS de nuestro Proxmox.
 *
 * Son los `os_slug` registrados como plantilla en el provisioner (una plantilla
 * cloud-init/cloudbase-init por SO en cada ubicación). Esta lista es la ÚNICA
 * fuente de verdad del selector del checkout, del panel de cliente y de la
 * validación en el servidor: un slug que no esté aquí no se acepta.
 *
 * `disponible: false` = conocido pero SIN plantilla lista todavía (p. ej. Windows,
 * cuya plantilla se prepara a mano en el nodo). No se ofrece al cliente ni se
 * acepta en pedidos/reinstalaciones hasta ponerlo a `true`, para no encolar una
 * provisión que el worker no sabría resolver.
 */

export type OsFamilia = "linux" | "windows";
export type OsOption = {
  slug: string;
  label: string;
  familia: OsFamilia;
  /** ¿Hay plantilla lista en el provisioner? Si no, no se ofrece ni se acepta. */
  disponible: boolean;
  /**
   * Disco mínimo (GB) del plan para poder instalarlo. Recoge a la vez el mínimo
   * del SO y el tamaño base de su plantilla: como el resize del provisioner es
   * absoluto y SOLO crece, un plan con menos disco que la plantilla ni siquiera
   * podría aprovisionarse. 0 = sin restricción (plantillas Linux, muy pequeñas).
   */
  minDiscoGb: number;
};

export const OS_OPTIONS: readonly OsOption[] = [
  { slug: "ubuntu-24.04", label: "Ubuntu 24.04 LTS", familia: "linux", disponible: true, minDiscoGb: 0 },
  { slug: "ubuntu-22.04", label: "Ubuntu 22.04 LTS", familia: "linux", disponible: true, minDiscoGb: 0 },
  { slug: "debian-12", label: "Debian 12", familia: "linux", disponible: true, minDiscoGb: 0 },
  { slug: "debian-13", label: "Debian 13", familia: "linux", disponible: true, minDiscoGb: 0 },
  { slug: "rocky-9", label: "Rocky Linux 9", familia: "linux", disponible: true, minDiscoGb: 0 },
  { slug: "almalinux-9", label: "AlmaLinux 9", familia: "linux", disponible: true, minDiscoGb: 0 },
  { slug: "almalinux-8", label: "AlmaLinux 8", familia: "linux", disponible: true, minDiscoGb: 0 },
  // Windows (BYOL: el cliente aporta su licencia). Oculto hasta que existan las
  // plantillas cloudbase-init en el nodo Proxmox; entonces pasar a disponible:true.
  // Win 11 exige 64 GB (MS) → no cabe en el plan Start (50 GB); mínimo Pro.
  { slug: "windows-server-2022", label: "Windows Server 2022", familia: "windows", disponible: true, minDiscoGb: 40 },
  { slug: "windows-server-2025", label: "Windows Server 2025", familia: "windows", disponible: true, minDiscoGb: 40 },
  { slug: "windows-11", label: "Windows 11", familia: "windows", disponible: false, minDiscoGb: 64 },
  { slug: "windows-10", label: "Windows 10", familia: "windows", disponible: false, minDiscoGb: 40 },
] as const;

/** SO por defecto si el cliente no elige otro. */
export const OS_DEFAULT = "ubuntu-24.04";

/** Lo que se ofrece de verdad: SO con plantilla lista. Úsalo en los selectores. */
export const OS_OFERTABLES: readonly OsOption[] = OS_OPTIONS.filter((o) => o.disponible);

const SLUGS = new Set(OS_OPTIONS.map((o) => o.slug));
const OFERTABLES = new Set(OS_OFERTABLES.map((o) => o.slug));

/** ¿Es un SO que conocemos (aunque quizá aún no ofertable)? */
export function isKnownOs(slug: string): boolean {
  return SLUGS.has(slug);
}

/** ¿Es un SO que podemos aprovisionar AHORA (tiene plantilla)? */
export function esOfertable(slug: string): boolean {
  return OFERTABLES.has(slug);
}

/** Familia del SO (linux por defecto para slugs desconocidos). */
export function osFamilia(slug: string): OsFamilia {
  return OS_OPTIONS.find((o) => o.slug === slug)?.familia ?? "linux";
}

/** Etiqueta legible de un SO, o el propio slug si no se conoce. */
export function osLabel(slug: string): string {
  return OS_OPTIONS.find((o) => o.slug === slug)?.label ?? slug;
}

/**
 * Extrae los GB de un texto de almacenamiento del catálogo ("50 GB NVMe" → 50).
 * Devuelve null si no puede (p. ej. dedicados "2 × 1 TB"), y entonces NO se
 * bloquea por disco: el worker del provisioner es el último filtro (su resize
 * absoluto fallaría al intentar encoger).
 */
export function discoGbDeTexto(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /(\d+)\s*GB/i.exec(s);
  return m ? Number(m[1]) : null;
}

/** ¿El disco (GB) del plan/servidor da para este SO? Sin dato de disco, no bloquea. */
export function osCumpleDisco(o: OsOption, discoGb: number | null | undefined): boolean {
  if (discoGb == null) return true;
  return discoGb >= o.minDiscoGb;
}

/** SO ofertables que además caben en un disco dado (para los selectores). */
export function ofertablesParaDisco(discoGb: number | null | undefined): OsOption[] {
  return OS_OFERTABLES.filter((o) => osCumpleDisco(o, discoGb));
}

/** ¿Se puede instalar AHORA este SO en un plan/servidor con este disco? */
export function esOfertableParaDisco(slug: string, discoGb: number | null | undefined): boolean {
  const o = OS_OPTIONS.find((x) => x.slug === slug);
  return !!o && o.disponible && osCumpleDisco(o, discoGb);
}
