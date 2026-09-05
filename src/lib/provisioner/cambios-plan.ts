import "server-only";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ProvisionerError, setVpsPlan } from "./client";

/**
 * Cambios de plan de un VPS solicitados desde el panel de cliente.
 *
 * Política (2026-09-05): AMPLIAR se cobra por adelantado con una proforma por la
 * diferencia de precio mensual entre planes y se aplica cuando la proforma pasa
 * a pagada (mismo camino que el alta: webhook, conciliador de Wise o "marcar
 * pagada" del admin). REDUCIR no se cobra y se aplica al instante; el precio
 * nuevo rige desde el siguiente cobro. El disco nunca se reduce.
 *
 * Almacén JSONL `data/plan-changes.jsonl` (0600), mismo estilo que
 * `intents.ts`: se reescribe entero en cada mutación.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "plan-changes.jsonl");

export type CambioPlan = {
  id: string;
  /** Ficha de servidor gestionado (id interno de la web). */
  servidorId: string;
  /** Id del VPS en el provisioner. */
  remoteId: number;
  userId: string;
  dePlan: string;
  aPlan: string;
  /** Importe cobrado (€); 0 en reducciones. */
  importe: number;
  /** Proforma que lo cobra, o null si se aplicó sin cobro (reducción). */
  invoiceId: string | null;
  estado: "pendiente" | "aplicado" | "error";
  error: string | null;
  creadoAt: string;
  aplicadoAt: string | null;
};

async function readAll(): Promise<CambioPlan[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: CambioPlan[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line) as CambioPlan;
      if (typeof d.id === "string" && typeof d.servidorId === "string") out.push(d);
    } catch {
      /* línea corrupta: se ignora */
    }
  }
  return out;
}

async function writeAll(list: CambioPlan[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, list.map((l) => JSON.stringify(l)).join("\n") + (list.length ? "\n" : ""), "utf8");
  await chmod(FILE, 0o600).catch(() => {});
}

export async function registrarCambioPlan(
  input: Omit<CambioPlan, "id" | "creadoAt" | "aplicadoAt" | "error" | "estado"> & { estado?: CambioPlan["estado"] },
): Promise<CambioPlan> {
  const list = await readAll();
  const c: CambioPlan = {
    ...input,
    id: randomUUID(),
    estado: input.estado ?? "pendiente",
    error: null,
    creadoAt: new Date().toISOString(),
    aplicadoAt: input.estado === "aplicado" ? new Date().toISOString() : null,
  };
  await writeAll([...list, c]);
  return c;
}

/** Cambio pendiente de pago de una ficha (a lo sumo uno). */
export async function cambioPendienteDeFicha(servidorId: string): Promise<CambioPlan | null> {
  const list = await readAll();
  return list.find((c) => c.servidorId === servidorId && c.estado === "pendiente") ?? null;
}

/** ¿Se ha aplicado alguna vez un cambio de plan a esta ficha? (el precio vigente ya no es el de la factura de alta). */
export async function tieneCambioAplicado(servidorId: string): Promise<boolean> {
  const list = await readAll();
  return list.some((c) => c.servidorId === servidorId && c.estado === "aplicado");
}

export async function historialDeFicha(servidorId: string): Promise<CambioPlan[]> {
  const list = await readAll();
  return list.filter((c) => c.servidorId === servidorId).sort((a, b) => b.creadoAt.localeCompare(a.creadoAt));
}

async function marcar(id: string, patch: Partial<CambioPlan>): Promise<void> {
  const list = await readAll();
  await writeAll(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

/**
 * Aplica en el provisioner los cambios de plan cobrados por una factura recién
 * pagada. Best-effort e idempotente: nunca lanza; lo que falle queda en estado
 * `error` con el motivo para que el admin lo repita.
 */
export async function aplicarCambiosPlanFacturaPagada(invoiceId: string): Promise<void> {
  const list = await readAll();
  for (const c of list) {
    if (c.invoiceId !== invoiceId || c.estado !== "pendiente") continue;
    try {
      await setVpsPlan(c.remoteId, c.aPlan);
      await marcar(c.id, { estado: "aplicado", aplicadoAt: new Date().toISOString(), error: null });
      console.info("[plan] cambio aplicado", c.servidorId, c.dePlan, "→", c.aPlan);
    } catch (err) {
      // El provisioner responde 409 same_plan si ya se aplicó (reintento): se da por hecho.
      if (err instanceof ProvisionerError && err.status === 409 && /same_plan/.test(err.message)) {
        await marcar(c.id, { estado: "aplicado", aplicadoAt: new Date().toISOString(), error: null });
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[plan] no se pudo aplicar el cambio de plan", c.id, msg);
      await marcar(c.id, { estado: "error", error: msg });
    }
  }
}
