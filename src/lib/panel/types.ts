/**
 * Tipos del panel de servicio (integración Proxmox, área de cliente).
 *
 * FASE 1 (maqueta): estos tipos describen la ficha completa que la pantalla
 * necesita pintar. De momento se rellenan con datos simulados (`mock.ts`); en la
 * Fase 2 los mismos tipos se alimentarán del provisioner a través del BFF, sin
 * tocar la UI.
 */

/** Estado comercial del servicio (lo que se muestra como badge en la cabecera). */
export type ServiceStatus = "activo" | "suspendido" | "cancelado";

/** Estado de energía de la máquina (condiciona qué acciones se habilitan). */
export type PowerState = "encendido" | "apagado" | "suspendido";

/** Ciclo de facturación. */
export type BillingCycle = "mensual" | "trimestral" | "anual";

/** Una dirección IP asignada, con su configuración de red. */
export type ServiceIp = {
  version: 4 | 6;
  address: string;
  mac: string;
  /** Máscara (v4) o longitud de prefijo (v6). */
  netmask: string;
  gateway: string;
};

/** Un valor con su límite, para las barras "actual / límite". */
export type Usage = {
  usado: number;
  total: number;
  /** Unidad para formatear (pct = %, mb, gb, mbps). */
  unidad: "pct" | "mb" | "gb" | "mbps";
};

/**
 * Ficha completa de un servicio para el panel. Reúne lo comercial (cabecera),
 * lo técnico (tabla de información) y la red (tabla de IPs).
 */
export type PanelService = {
  id: string;

  /* Cabecera comercial */
  producto: string;
  plan: string;
  status: ServiceStatus;
  power: PowerState;
  altaAt: string; // ISO
  importeEur: number;
  ciclo: BillingCycle;
  vencimientoAt: string; // ISO
  metodoPago: string;

  /* Información técnica */
  nodo: string;
  nombre: string; // hostname
  password: string; // se muestra enmascarada, con botón copiar
  uptimeSec: number;
  creadoAt: string; // ISO
  descripcion: string;
  cpu: Usage; // % sobre N cores
  cores: number;
  memoria: Usage; // MB
  swap: Usage; // MB
  disco: Usage; // GB
  backupsLimite: number;
  tasaRedMbps: number;
  iso: string | null; // ISO montada, o null
  ordenArranque: string;
  anchoBanda: Usage; // GB consumidos / total

  /* Red */
  ips: ServiceIp[];
};
