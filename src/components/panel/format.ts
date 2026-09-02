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

/** ¿Se puede dibujar una barra? (hay uso Y un total contra el que medir). */
export function tieneBarra(u: Usage): boolean {
  return u.usado !== null && u.total !== null && u.total > 0;
}

/** Porcentaje de uso 0–100 de un `Usage`, acotado. Asume `tieneBarra`. */
export function usagePct(u: Usage): number {
  if (u.usado === null) return 0;
  if (u.unidad === "pct") return clamp(u.usado);
  if (!u.total) return 0;
  return clamp((u.usado / u.total) * 100);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Texto "usado / total" con la unidad. Muestra "—" donde no hay dato. */
export function usageText(u: Usage): string {
  const dash = "—";
  switch (u.unidad) {
    case "pct":
      return u.usado === null ? dash : `${Math.round(u.usado)}%`;
    case "mb":
      if (u.usado === null && u.total === null) return dash;
      if (u.total === null) return `${gb(u.usado!)} GB`;
      return `${u.usado === null ? dash : gb(u.usado)} / ${gb(u.total)} GB`;
    case "gb":
      if (u.usado === null && u.total === null) return dash;
      if (u.total === null) return `${round1(u.usado!)} GB`;
      return `${u.usado === null ? dash : round1(u.usado)} / ${round1(u.total)} GB`;
    case "mbps":
      return u.usado === null && u.total === null
        ? dash
        : `${u.usado ?? dash}${u.total !== null ? ` / ${u.total}` : ""} Mbps`;
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
