import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PaymentEvent } from "./types";

/**
 * Idempotencia de webhooks de pago.
 *
 * Las pasarelas reintentan la entrega (y pueden entregar el mismo evento más de
 * una vez). Para no procesar dos veces un cobro, deduplicamos por `event.id`.
 *
 * Dos capas:
 *  - Un Set en memoria que da una reserva ATÓMICA dentro del proceso (Node es
 *    monohilo; `reserve()` comprueba-y-marca sin huecos), evitando que dos
 *    entregas concurrentes del mismo evento se cuelen a la vez.
 *  - Un fichero JSONL (`data/payment-events.jsonl`) como fuente de verdad que
 *    sobrevive a reinicios. Se carga perezosamente al Set la primera vez.
 *
 * A esta escala (un proceso pm2) es suficiente. Con varias réplicas habría que
 * mover la reserva a un almacén compartido (Redis SET NX / fila única en BD).
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "payment-events.jsonl");

const seen = new Set<string>();
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const content = await readFile(FILE, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as { id?: string };
        if (rec.id) seen.add(rec.id);
      } catch {
        // Línea corrupta: ignorar.
      }
    }
  } catch {
    // Sin fichero todavía: empezamos vacío.
  }
  loaded = true;
}

/**
 * Reserva el id para procesarlo. Devuelve `true` si es nuevo (procédelo), o
 * `false` si ya estaba visto/reservado (duplicado → ignóralo). Atómico en proceso.
 */
export async function reserve(id: string): Promise<boolean> {
  await ensureLoaded();
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
}

/** Libera una reserva si el procesamiento falló, para permitir un reintento. */
export function release(id: string): void {
  seen.delete(id);
}

/** Persiste el evento ya procesado en el JSONL (fuente de verdad). */
export async function markProcessed(
  event: PaymentEvent,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const record = {
    id: event.id,
    type: event.type,
    orderId: event.orderId,
    amountCents: event.amountCents,
    currency: event.currency,
    succeeded: event.succeeded,
    processedAt: new Date().toISOString(),
    ...extra,
  };
  await appendFile(FILE, JSON.stringify(record) + "\n", "utf8");
}
