/**
 * Estado del sistema (datos de demostración).
 * TODO: conectar a una fuente real (API de monitorización) si existe.
 */

export type StatusLevel = "operational" | "degraded" | "maintenance" | "outage";

export const statusMeta: Record<
  StatusLevel,
  { label: string; color: string; dot: string }
> = {
  operational: { label: "Operativo", color: "var(--color-accent)", dot: "bg-[var(--color-accent)]" },
  degraded: { label: "Rendimiento degradado", color: "#febc2e", dot: "bg-[#febc2e]" },
  maintenance: { label: "Mantenimiento", color: "#5b9dff", dot: "bg-[#5b9dff]" },
  outage: { label: "Incidencia", color: "var(--color-danger)", dot: "bg-[var(--color-danger)]" },
};

export type ServiceStatus = { name: string; status: StatusLevel; note?: string };

/** Servicios de la plataforma. */
export const services: ServiceStatus[] = [
  { name: "API de provisioning", status: "operational" },
  { name: "Panel de cliente", status: "operational" },
  { name: "Red / backbone", status: "operational" },
  { name: "Mitigación DDoS", status: "operational" },
  { name: "Almacenamiento NVMe", status: "operational" },
  { name: "Facturación y pagos", status: "maintenance", note: "Mantenimiento programado 02:00–03:00 CET" },
];

/** Estado por región (alineado con los slugs de products.ts). */
export const regionStatus: Record<string, StatusLevel> = {
  francia: "operational",
  alemania: "operational",
};

/** Histórico reciente de incidencias (placeholder). */
export type Incident = { date: string; title: string; resolved: boolean; detail: string };

export const incidents: Incident[] = [
  {
    date: "2026-06-08",
    title: "Latencia elevada en París",
    resolved: false,
    detail: "Estamos investigando un aumento de latencia en el nodo de París. Sin impacto en disponibilidad.",
  },
  {
    date: "2026-06-02",
    title: "Mantenimiento de red en Fráncfort",
    resolved: true,
    detail: "Actualización de routers completada sin incidencias. Sin tiempo de inactividad.",
  },
];

/** Estado global derivado del peor estado individual. */
export function overallStatus(): StatusLevel {
  const order: StatusLevel[] = ["operational", "maintenance", "degraded", "outage"];
  const all = [...services.map((s) => s.status), ...Object.values(regionStatus)];
  return all.reduce((worst, s) => (order.indexOf(s) > order.indexOf(worst) ? s : worst), "operational");
}
