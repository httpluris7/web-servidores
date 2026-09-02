import type { IconName } from "./icons";

/**
 * Arquitectura de navegación del panel de servicio, en un único sitio: la barra
 * lateral y la rejilla "Gestión del servicio" leen de aquí, así nunca se
 * desincronizan. Cada `key` es también la clave de traducción
 * (`panel.sidebar.items.<key>`) y el ancla al que salta la barra lateral.
 *
 * FASE 1: los enlaces apuntan a las secciones que ya existen en la maqueta
 * (#resumen, #acciones, #gestion, #informacion, #ips). Las herramientas que aún
 * no tienen pantalla propia apuntan a #gestion (su tarjeta en la rejilla). En
 * fases siguientes cada herramienta tendrá su propio panel.
 */

export type NavItem = {
  key: string;
  /** Ancla dentro de la página (sin locale: es navegación interna por scroll). */
  anchor: string;
  icon: IconName;
  /** true cuando la herramienta aún no está implementada (se marca "pronto"). */
  soon?: boolean;
};

export type NavGroup = {
  key: "overview" | "acciones" | "gestion";
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    items: [
      { key: "resumen", anchor: "resumen", icon: "gauge" },
      { key: "informacion", anchor: "informacion", icon: "info" },
      { key: "ips", anchor: "ips", icon: "globe" },
      { key: "plantillas", anchor: "gestion", icon: "layers", soon: true },
    ],
  },
  {
    key: "acciones",
    items: [
      { key: "energia", anchor: "acciones", icon: "power" },
      { key: "plan", anchor: "gestion", icon: "sliders", soon: true },
    ],
  },
  {
    key: "gestion",
    items: [
      { key: "backups", anchor: "gestion", icon: "archive", soon: true },
      { key: "backupsSchedule", anchor: "gestion", icon: "clock", soon: true },
      { key: "discos", anchor: "gestion", icon: "disk", soon: true },
      { key: "firewall", anchor: "gestion", icon: "shield", soon: true },
      { key: "firewallOptions", anchor: "gestion", icon: "shieldGear", soon: true },
      { key: "graficas", anchor: "gestion", icon: "chart", soon: true },
      { key: "red", anchor: "gestion", icon: "network", soon: true },
      { key: "consola", anchor: "gestion", icon: "terminal", soon: true },
      { key: "reinstalar", anchor: "gestion", icon: "refresh", soon: true },
      { key: "notificaciones", anchor: "gestion", icon: "bell", soon: true },
      { key: "monitorizacion", anchor: "gestion", icon: "activity", soon: true },
      { key: "snapshots", anchor: "gestion", icon: "camera", soon: true },
      { key: "historial", anchor: "gestion", icon: "history", soon: true },
      { key: "tareasEnergia", anchor: "gestion", icon: "power", soon: true },
    ],
  },
];

/** Las herramientas de la rejilla "Gestión del servicio" (grupo gestion). */
export const MANAGEMENT_TOOLS: NavItem[] =
  NAV_GROUPS.find((g) => g.key === "gestion")!.items;

/** Secciones con ancla real en la página (para el scroll-spy de la barra). */
export const PAGE_SECTIONS = ["resumen", "acciones", "gestion", "informacion", "ips"] as const;

/** Acciones de energía de la rejilla "Acciones del servicio". */
export type PowerAction = {
  key: "start" | "restart" | "stop" | "shutdown" | "reconfigNetwork" | "changePassword";
  icon: IconName;
  /** Estados de energía en los que la acción tiene sentido. */
  enabledWhen: Array<"encendido" | "apagado" | "suspendido">;
  /** Acción "dura"/destructiva: se pinta con acento de peligro al pasar el ratón. */
  danger?: boolean;
};

export const POWER_ACTIONS: PowerAction[] = [
  { key: "start", icon: "play", enabledWhen: ["apagado"] },
  { key: "restart", icon: "rotate", enabledWhen: ["encendido"] },
  { key: "stop", icon: "square", enabledWhen: ["encendido"], danger: true },
  { key: "shutdown", icon: "power", enabledWhen: ["encendido"] },
  { key: "reconfigNetwork", icon: "network", enabledWhen: ["encendido", "apagado"] },
  { key: "changePassword", icon: "key", enabledWhen: ["encendido", "apagado"] },
];
