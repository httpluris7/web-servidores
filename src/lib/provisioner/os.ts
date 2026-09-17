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
  /**
   * Imagen EXCLUSIVA de una familia de producto: no sale en los selectores
   * generales ni se acepta en un plan cualquiera. Hoy solo la usa la imagen de
   * los AI Developer VPS, que va fijada por el plan (`Plan.osFijo`).
   */
  exclusivo?: boolean;
};

/**
 * Imagen de los AI Developer VPS: Ubuntu 24.04 LTS con Claude Code, OpenAI Codex
 * CLI, Docker y el stack de desarrollo preinstalados, usuario `developer`. Es el
 * `os_slug` de la plantilla `ubuntu-24-ai-developer` del provisioner.
 */
export const AI_DEVELOPER_OS = "ubuntu-24-ai-developer";

export const OS_OPTIONS: readonly OsOption[] = [
  { slug: "ubuntu-24.04", label: "Ubuntu 24.04 LTS", familia: "linux", disponible: true, minDiscoGb: 0 },
  // La plantilla mide 16 GB; los planes AI empiezan en 60 GB.
  { slug: AI_DEVELOPER_OS, label: "Ubuntu 24.04 LTS · AI Developer (Claude Code + Codex)", familia: "linux", disponible: true, minDiscoGb: 16, exclusivo: true },
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

/**
 * Lo que se ofrece de verdad en un plan cualquiera: SO con plantilla lista y no
 * exclusivos de una familia. Úsalo en los selectores.
 */
export const OS_OFERTABLES: readonly OsOption[] = OS_OPTIONS.filter((o) => o.disponible && !o.exclusivo);

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

/** ¿Se puede instalar AHORA este SO en un plan/servidor cualquiera con este disco? */
export function esOfertableParaDisco(slug: string, discoGb: number | null | undefined): boolean {
  const o = OS_OPTIONS.find((x) => x.slug === slug);
  return !!o && o.disponible && !o.exclusivo && osCumpleDisco(o, discoGb);
}

/* ------------------------- Planes con imagen fijada ------------------------ */

/**
 * SO que puede elegir quien CONTRATA un plan: si el plan fija imagen (AI
 * Developer VPS), solo esa; si no, los generales que caben en su disco.
 */
export function ofertablesParaPlan(plan: { storage: string; osFijo?: string }): OsOption[] {
  if (plan.osFijo) return OS_OPTIONS.filter((o) => o.slug === plan.osFijo && o.disponible);
  return ofertablesParaDisco(discoGbDeTexto(plan.storage));
}

/**
 * SO con el que se aprovisiona un pedido: el fijado por el plan manda sobre lo
 * que llegue del navegador; si no fija ninguno, el elegido si es válido para el
 * disco del plan, y si no el de por defecto.
 */
export function osParaPedido(plan: { storage: string; osFijo?: string }, elegido: string): string {
  if (plan.osFijo) return plan.osFijo;
  return esOfertableParaDisco(elegido, discoGbDeTexto(plan.storage)) ? elegido : OS_DEFAULT;
}

/**
 * SO a los que se puede REINSTALAR un servidor: los generales que caben en su
 * disco y, si el servidor es de un plan con imagen propia, también esa (para
 * volver al entorno AI Developer de fábrica). Cambiar a otro SO sigue permitido.
 */
export function ofertablesParaReinstalar(
  discoGb: number | null | undefined,
  imagenPropia?: string | null,
): OsOption[] {
  const propia = imagenPropia
    ? OS_OPTIONS.filter((o) => o.slug === imagenPropia && o.disponible && osCumpleDisco(o, discoGb))
    : [];
  return [...propia, ...ofertablesParaDisco(discoGb)];
}

/** ¿Se puede reinstalar AHORA a este SO? (validación en servidor del anterior). */
export function esReinstalable(
  slug: string,
  discoGb: number | null | undefined,
  imagenPropia?: string | null,
): boolean {
  return ofertablesParaReinstalar(discoGb, imagenPropia).some((o) => o.slug === slug);
}
