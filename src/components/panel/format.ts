import type { Usage } from "@/lib/panel/types";

/** Uptime en segundos → "12d 7h 3m" (compacto). Vacío si no hay dato. */
export function formatUptime(sec: number): string {
  if (!sec || sec < 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

/** Porcentaje de uso 0–100 de un `Usage`, acotado. */
export function usagePct(u: Usage): number {
  if (u.unidad === "pct") return clamp(u.usado);
  if (!u.total) return 0;
  return clamp((u.usado / u.total) * 100);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Texto "usado / total" con la unidad, legible. */
export function usageText(u: Usage): string {
  switch (u.unidad) {
    case "pct":
      return `${Math.round(u.usado)}%`;
    case "mb":
      return `${gb(u.usado)} / ${gb(u.total)} GB`;
    case "gb":
      return `${round1(u.usado)} / ${round1(u.total)} GB`;
    case "mbps":
      return `${u.usado} / ${u.total} Mbps`;
  }
}

function gb(mb: number): string {
  return round1(mb / 1024);
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** Fecha ISO → fecha local legible según el idioma. */
export function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}
