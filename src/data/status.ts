/**
 * Estado del sistema (datos de demostración).
 * TODO: conectar a una fuente real (API de monitorización) si existe.
 */

export type StatusLevel = "operational" | "degraded" | "maintenance" | "outage";

export const statusMeta: Record<
  StatusLevel,
  { label: string; color: string; dot: string }
> = {
  operational: { label: "Operational", color: "var(--color-accent)", dot: "bg-[var(--color-accent)]" },
  degraded: { label: "Degraded performance", color: "#febc2e", dot: "bg-[#febc2e]" },
  maintenance: { label: "Maintenance", color: "#5b9dff", dot: "bg-[#5b9dff]" },
  outage: { label: "Outage", color: "var(--color-danger)", dot: "bg-[var(--color-danger)]" },
};

export type ServiceStatus = { name: string; status: StatusLevel; note?: string };

/** Servicios de la plataforma. */
export const services: ServiceStatus[] = [
  { name: "Provisioning API", status: "operational" },
  { name: "Customer panel", status: "operational" },
  { name: "Network / backbone", status: "operational" },
  { name: "DDoS Mitigation", status: "operational" },
  { name: "NVMe storage", status: "operational" },
  { name: "Billing and payments", status: "maintenance", note: "Scheduled maintenance 02:00–03:00 CET" },
];

/** Estado por región (alineado con los slugs de products.ts). */
export const regionStatus: Record<string, StatusLevel> = {
  francia: "operational",
};

/** Histórico reciente de incidencias (placeholder). */
export type Incident = { date: string; title: string; resolved: boolean; detail: string };

export const incidents: Incident[] = [
  {
    date: "2026-06-08",
    title: "Elevated latency in Paris",
    resolved: false,
    detail: "We are investigating an increase in latency on the Paris node. No impact on availability.",
  },
  {
    date: "2026-06-02",
    title: "Network maintenance in Frankfurt",
    resolved: true,
    detail: "Router upgrade completed without incident. No downtime.",
  },
];

/** Estado global derivado del peor estado individual. */
export function overallStatus(): StatusLevel {
  const order: StatusLevel[] = ["operational", "maintenance", "degraded", "outage"];
  const all = [...services.map((s) => s.status), ...Object.values(regionStatus)];
  return all.reduce((worst, s) => (order.indexOf(s) > order.indexOf(worst) ? s : worst), "operational");
}
