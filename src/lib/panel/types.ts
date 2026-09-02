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
  /** Consumo actual, o null si no se conoce (p. ej. disco sin agente instalado). */
  usado: number | null;
  /** Límite/total, o null si no aplica (p. ej. ancho de banda sin tope). */
  total: number | null;
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
  /**
   * Contraseña en claro SOLO si está disponible (maqueta). En los VPS reales no
   * se almacena: es null y `passwordManaged` indica que se entrega por email.
   */
  password: string | null;
  passwordManaged: boolean;
  uptimeSec: number;
  creadoAt: string; // ISO
  descripcion: string;
  cpu: Usage; // % sobre N cores
  cores: number | null;
  memoria: Usage; // MB
  swap: Usage; // % (guest, vía agente)
  disco: Usage; // GB
  backupsLimite: number | null;
  tasaRedMbps: number | null;
  iso: string | null; // ISO montada, o null
  ordenArranque: string;
  anchoBanda: Usage; // GB consumidos (sin tope → total null)

  /* Red */
  ips: ServiceIp[];

  /** ¿Hay un agente de métricas activo? Decide gráficas de agente vs RRD. */
  agenteActivo: boolean;
};
