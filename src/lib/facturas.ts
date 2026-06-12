import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Almacén de facturas en JSONL (`data/facturas.jsonl`), misma filosofía que
 * `lib/auth.ts` y `lib/leads.ts`: cero dependencias externas, suficiente para
 * una escala pequeña. A diferencia de los leads (append-only), las facturas
 * cambian de estado y pueden borrarse, así que reescribimos el fichero entero
 * en cada mutación. Sin locks: best-effort, basta para este volumen.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "facturas.jsonl");

export type InvoiceStatus = "pendiente" | "pagada" | "cancelada";

export type Invoice = {
  id: string;
  numero: string; // F-2026-0001 (secuencial por año de emisión)
  userId: string | null; // usuario registrado vinculado (o null si es manual)
  clienteEmail: string;
  clienteNombre: string;
  concepto: string;
  base: number; // base imponible en €
  ivaPct: number; // % de IVA aplicado
  total: number; // base + IVA (calculado al crear)
  estado: InvoiceStatus;
  emitidaAt: string; // ISO
  vencimientoAt: string; // ISO
  pagadaAt: string | null;
  notas: string;
};

export type NewInvoiceInput = {
  userId?: string | null;
  clienteEmail: string;
  clienteNombre: string;
  concepto: string;
  base: number;
  ivaPct?: number; // por defecto 21
  vencimientoDias?: number; // días desde la emisión (por defecto 30)
  notas?: string;
};

/* ------------------------------- Persistencia ----------------------------- */

async function readAll(): Promise<Invoice[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: Invoice[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Invoice);
    } catch {
      // Línea corrupta: la ignoramos en lugar de romper todo el listado.
    }
  }
  return out;
}

async function writeAll(list: Invoice[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((inv) => JSON.stringify(inv)).join("\n");
  await writeFile(FILE, body ? body + "\n" : "", "utf8");
}

/** Calcula el siguiente número de factura para el año dado (F-AAAA-NNNN). */
function nextNumero(list: Invoice[], year: number): string {
  const prefix = `F-${year}-`;
  const max = list
    .filter((i) => i.numero.startsWith(prefix))
    .reduce((acc, i) => {
      const n = Number.parseInt(i.numero.slice(prefix.length), 10);
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** Redondea a 2 decimales evitando errores de coma flotante. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* --------------------------------- Lectura -------------------------------- */

/** Todas las facturas, de la más reciente a la más antigua. */
export async function listInvoices(): Promise<Invoice[]> {
  const list = await readAll();
  return list.sort((a, b) => b.emitidaAt.localeCompare(a.emitidaAt));
}

/** Facturas de un usuario concreto (por id o, en su defecto, por email). */
export async function listInvoicesByUser(
  userId: string,
  email?: string
): Promise<Invoice[]> {
  const target = email?.trim().toLowerCase();
  const list = await listInvoices();
  return list.filter(
    (i) => i.userId === userId || (!!target && i.clienteEmail.toLowerCase() === target)
  );
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const list = await readAll();
  return list.find((i) => i.id === id) ?? null;
}

/* -------------------------------- Mutaciones ------------------------------ */

export async function createInvoice(input: NewInvoiceInput): Promise<Invoice> {
  const list = await readAll();
  const now = new Date();
  const ivaPct = input.ivaPct ?? 21;
  const base = round2(input.base);
  const total = round2(base * (1 + ivaPct / 100));

  const vencimiento = new Date(now);
  vencimiento.setDate(vencimiento.getDate() + (input.vencimientoDias ?? 30));

  const invoice: Invoice = {
    id: randomUUID(),
    numero: nextNumero(list, now.getFullYear()),
    userId: input.userId ?? null,
    clienteEmail: input.clienteEmail.trim().toLowerCase(),
    clienteNombre: input.clienteNombre.trim(),
    concepto: input.concepto.trim(),
    base,
    ivaPct,
    total,
    estado: "pendiente",
    emitidaAt: now.toISOString(),
    vencimientoAt: vencimiento.toISOString(),
    pagadaAt: null,
    notas: (input.notas ?? "").trim(),
  };

  list.push(invoice);
  await writeAll(list);
  return invoice;
}

/** Cambia el estado de una factura (y sella `pagadaAt` al marcarla pagada). */
export async function setInvoiceStatus(
  id: string,
  estado: InvoiceStatus
): Promise<Invoice | null> {
  const list = await readAll();
  const current = list.find((i) => i.id === id);
  if (!current) return null;
  const updated: Invoice = {
    ...current,
    estado,
    pagadaAt: estado === "pagada" ? new Date().toISOString() : null,
  };
  const next = list.map((i) => (i.id === id ? updated : i));
  await writeAll(next);
  return updated;
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const list = await readAll();
  const next = list.filter((i) => i.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}

/* --------------------------------- Métricas ------------------------------- */

export type InvoiceStats = {
  total: number; // nº de facturas
  facturado: number; // suma de totales (todas)
  cobrado: number; // suma de totales pagados
  pendiente: number; // suma de totales pendientes
};

export function invoiceStats(list: Invoice[]): InvoiceStats {
  return list.reduce<InvoiceStats>(
    (acc, i) => {
      acc.total += 1;
      acc.facturado = round2(acc.facturado + i.total);
      if (i.estado === "pagada") acc.cobrado = round2(acc.cobrado + i.total);
      if (i.estado === "pendiente") acc.pendiente = round2(acc.pendiente + i.total);
      return acc;
    },
    { total: 0, facturado: 0, cobrado: 0, pendiente: 0 }
  );
}
