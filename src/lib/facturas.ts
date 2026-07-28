import { randomUUID, randomBytes } from "node:crypto";
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

/** Métodos de pago ofrecidos. */
export type PaymentMethod = "stripe" | "paypal" | "revolut" | "transferencia";
export const PAYMENT_METHODS: PaymentMethod[] = ["stripe", "paypal", "revolut", "transferencia"];

/** Etiqueta legible (en inglés) de cada método de pago. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  revolut: "Revolut Pay",
  transferencia: "Bank transfer",
};

/** Línea de factura: un producto/servicio con cantidad y precio unitario. */
export type InvoiceLine = {
  concepto: string; // nombre del producto o servicio
  descripcion: string; // descripción libre (puede ir vacía)
  cantidad: number; // unidades (>= 1)
  precioUnitario: number; // € por unidad
  subtotal: number; // cantidad × precioUnitario (calculado al crear)
  productId: string | null; // id del catálogo si procede, o null si es manual
};

/** Sesión de pago abierta en la pasarela para cobrar una factura. */
export type InvoicePayment = {
  provider: "stripe";
  sessionId: string;
  /** Enlace al que enviar al cliente (Stripe lo caduca a las 24 h). */
  url: string;
  createdAt: string; // ISO
  /** Nº de enlaces generados para esta factura; da la clave de idempotencia. */
  intentos: number;
};

export type Invoice = {
  id: string;
  // Número mostrado: mientras NO está pagada es el de la proforma (aleatorio,
  // PRO-AAAA-XXXXXX); al pagarse pasa a ser el número fiscal de la serie.
  numero: string;
  // Número fiscal de la serie (FACT-AAAA-NNN). Se asigna SOLO al confirmar el
  // pago y ya no cambia (continuidad de serie, sin huecos). null = proforma.
  numeroFactura: string | null;
  metodoPago: PaymentMethod | null; // método de cobro (informativo)
  pago: InvoicePayment | null; // sesión de pago viva en la pasarela, si la hay
  userId: string | null; // usuario registrado vinculado (o null si es manual)
  clienteEmail: string;
  clienteNombre: string;
  lineas: InvoiceLine[]; // una o más líneas de producto
  base: number; // base imponible en € (suma de subtotales, calculado)
  ivaPct: number; // % de IVA global aplicado
  total: number; // base + IVA (calculado al crear)
  estado: InvoiceStatus;
  emitidaAt: string; // ISO
  vencimientoAt: string; // ISO
  pagadaAt: string | null;
  notas: string;
};

export type NewInvoiceLineInput = {
  concepto: string;
  descripcion?: string;
  cantidad: number;
  precioUnitario: number;
  productId?: string | null;
};

export type NewInvoiceInput = {
  userId?: string | null;
  clienteEmail: string;
  clienteNombre: string;
  lineas: NewInvoiceLineInput[];
  ivaPct?: number; // por defecto 0 (sin impuestos)
  vencimientoDias?: number; // días desde la emisión (por defecto 30)
  notas?: string;
  metodoPago?: PaymentMethod | null;
};

/** ¿Es una factura final (pagada) o todavía una proforma? */
export function esProforma(inv: Invoice): boolean {
  return inv.estado !== "pagada";
}

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
      out.push(normalize(JSON.parse(line)));
    } catch {
      // Línea corrupta: la ignoramos en lugar de romper todo el listado.
    }
  }
  return out;
}

/**
 * Normaliza un registro leído de disco. Las facturas antiguas guardaban un
 * único `concepto` + `base`; las convertimos en una sola línea para que el
 * resto del código trabaje siempre con `lineas`.
 */
function normalize(raw: Record<string, unknown>): Invoice {
  let inv = raw as unknown as Invoice;
  // Compat: facturas antiguas con un único concepto -> una sola línea.
  if (!Array.isArray(raw.lineas)) {
    const precioUnitario = round2(Number(raw.base) || 0);
    inv = {
      ...inv,
      lineas: [
        {
          concepto: typeof raw.concepto === "string" ? raw.concepto : "",
          descripcion: "",
          cantidad: 1,
          precioUnitario,
          subtotal: precioUnitario,
          productId: null,
        },
      ],
    };
  }
  // Compat: campos de proforma/serie y método de pago (facturas previas al cambio).
  if (raw.numeroFactura === undefined) {
    inv = { ...inv, numeroFactura: raw.estado === "pagada" ? inv.numero : null };
  }
  if (raw.metodoPago === undefined) {
    inv = { ...inv, metodoPago: null };
  }
  // Compat: sesión de pago (facturas anteriores a la integración de la pasarela).
  if (raw.pago === undefined) {
    inv = { ...inv, pago: null };
  }
  return inv;
}

async function writeAll(list: Invoice[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((inv) => JSON.stringify(inv)).join("\n");
  await writeFile(FILE, body ? body + "\n" : "", "utf8");
}

/**
 * Siguiente número de la serie FISCAL para el año dado (FACT-AAAA-NNN). Se
 * deriva de los `numeroFactura` ya asignados, de modo que la serie no tiene
 * huecos: solo consumen número las facturas que llegan a pagarse.
 */
function nextFacturaNumero(list: Invoice[], year: number): string {
  const prefix = `FACT-${year}-`;
  const max = list.reduce((acc, i) => {
    if (!i.numeroFactura || !i.numeroFactura.startsWith(prefix)) return acc;
    const n = Number.parseInt(i.numeroFactura.slice(prefix.length), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** Genera un número de proforma aleatorio y único (PRO-AAAA-XXXXXX). */
function newProformaNumero(list: Invoice[], year: number): string {
  const used = new Set(list.map((i) => i.numero));
  let numero: string;
  do {
    numero = `PRO-${year}-${randomBytes(3).toString("hex").toUpperCase()}`;
  } while (used.has(numero));
  return numero;
}

/** Redondea a 2 decimales evitando errores de coma flotante. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* --------------------------------- Lectura -------------------------------- */

/** Resumen legible de las líneas de una factura (para listados). */
export function invoiceConcepto(inv: Invoice): string {
  const first = inv.lineas[0]?.concepto ?? "";
  const extra = inv.lineas.length - 1;
  return extra > 0 ? `${first} +${extra}` : first;
}

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
  const ivaPct = input.ivaPct ?? 0; // por defecto sin impuestos (LLC US)

  const lineas: InvoiceLine[] = input.lineas.map((l) => {
    const cantidad = Math.max(1, Math.round(Number(l.cantidad) || 1));
    const precioUnitario = round2(Number(l.precioUnitario) || 0);
    return {
      concepto: l.concepto.trim(),
      descripcion: (l.descripcion ?? "").trim(),
      cantidad,
      precioUnitario,
      subtotal: round2(cantidad * precioUnitario),
      productId: l.productId ?? null,
    };
  });

  const base = round2(lineas.reduce((acc, l) => acc + l.subtotal, 0));
  const total = round2(base * (1 + ivaPct / 100));

  const vencimiento = new Date(now);
  vencimiento.setDate(vencimiento.getDate() + (input.vencimientoDias ?? 30));

  const invoice: Invoice = {
    id: randomUUID(),
    // Nace como PROFORMA con número aleatorio; el número fiscal se asigna al pagar.
    numero: newProformaNumero(list, now.getFullYear()),
    numeroFactura: null,
    metodoPago: input.metodoPago ?? null,
    pago: null,
    userId: input.userId ?? null,
    clienteEmail: input.clienteEmail.trim().toLowerCase(),
    clienteNombre: input.clienteNombre.trim(),
    lineas,
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

export type SetStatusResult = {
  invoice: Invoice;
  /** true si en esta llamada pasó de no-pagada a pagada (para emitir/enviar). */
  justPaid: boolean;
};

/**
 * Cambia el estado de una factura. Al pasar a `pagada` por primera vez, asigna
 * el número fiscal de la serie (FACT-AAAA-NNN) —que ya no cambia— y sella
 * `pagadaAt`. Devuelve `justPaid` para que quien llama emita la factura final.
 */
export async function setInvoiceStatus(
  id: string,
  estado: InvoiceStatus
): Promise<SetStatusResult | null> {
  const list = await readAll();
  const current = list.find((i) => i.id === id);
  if (!current) return null;

  const becomingPaid = estado === "pagada" && current.estado !== "pagada";

  // Asigna el número fiscal solo la primera vez que se cobra; después se conserva.
  const numeroFactura =
    estado === "pagada"
      ? (current.numeroFactura ?? nextFacturaNumero(list, new Date().getFullYear()))
      : current.numeroFactura;

  const updated: Invoice = {
    ...current,
    estado,
    numeroFactura,
    // Una vez hay número fiscal, el número mostrado pasa a ser ese.
    numero: numeroFactura ?? current.numero,
    pagadaAt: estado === "pagada" ? (current.pagadaAt ?? new Date().toISOString()) : null,
  };
  const next = list.map((i) => (i.id === id ? updated : i));
  await writeAll(next);
  return { invoice: updated, justPaid: becomingPaid };
}

/**
 * Guarda (o sustituye) la sesión de pago de una factura. Devuelve la factura ya
 * actualizada, o null si no existe.
 */
export async function setInvoicePayment(
  id: string,
  pago: InvoicePayment | null
): Promise<Invoice | null> {
  const list = await readAll();
  const current = list.find((i) => i.id === id);
  if (!current) return null;
  const updated: Invoice = { ...current, pago };
  await writeAll(list.map((i) => (i.id === id ? updated : i)));
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
