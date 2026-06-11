import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Persistencia mínima de leads (contacto y pedidos) en ficheros JSONL.
 *
 * No dependemos de ningún servicio externo: cada solicitud se anexa como una
 * línea JSON en `data/<tipo>.jsonl`, dentro del directorio de la app. El
 * responsable puede leer/exportar esos ficheros, o engancharlos a un cron.
 *
 * Opcionalmente, si está definida la variable de entorno `LEADS_WEBHOOK_URL`,
 * cada lead se reenvía por POST a ese webhook (Slack, n8n, CRM, etc.).
 */

const DATA_DIR = path.join(process.cwd(), "data");

export type LeadKind = "contacto" | "pedido";

export async function saveLead(kind: LeadKind, payload: Record<string, unknown>): Promise<void> {
  const record = {
    ...payload,
    kind,
    receivedAt: new Date().toISOString(),
  };

  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(path.join(DATA_DIR, `${kind}s.jsonl`), JSON.stringify(record) + "\n", "utf8");

  const webhook = process.env.LEADS_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch {
      // El webhook es best-effort: si falla, el lead ya quedó persistido en disco.
    }
  }
}

export const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Recorta y normaliza un string de entrada para evitar abusos de tamaño. */
export function clean(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
