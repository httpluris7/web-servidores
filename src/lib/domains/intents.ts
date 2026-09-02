import "server-only";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Intenciones de registro de dominio, ligadas a la factura (proforma).
 *
 * Mismo patrón que `provisioner/intents.ts` para los VPS: al hacer checkout de un
 * dominio guardamos aquí, indexado por `invoiceId`, lo que hará falta para
 * registrarlo (nombre + años + dueño). Cuando la proforma pase a pagada (webhook
 * de tarjeta o conciliador de transferencia), se lee esto y se llama a Njalla.
 *
 * Almacén JSONL (`data/domain-intents.jsonl`), 0600, reescrito entero en cada
 * mutación (fichero diminuto). Unicidad: `(invoiceId, domain)`.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "domain-intents.jsonl");

export type DomainIntent = {
  invoiceId: string;
  domain: string;
  years: number;
  userId: string | null;
  email: string;
  idioma: "es" | "en";
  creadoAt: string;
  /** ¿Ya se registró en Njalla? (idempotencia del CP3). */
  registered: boolean;
  /** Nombre devuelto por Njalla al registrar (confirmación). */
  njallaName: string | null;
};

export type NuevaDomainIntent = Omit<DomainIntent, "creadoAt" | "registered" | "njallaName">;

async function readAll(): Promise<DomainIntent[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: DomainIntent[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line) as Partial<DomainIntent>;
      if (typeof d.invoiceId === "string" && typeof d.domain === "string") {
        out.push({
          invoiceId: d.invoiceId,
          domain: d.domain,
          years: typeof d.years === "number" ? d.years : 1,
          userId: typeof d.userId === "string" ? d.userId : null,
          email: d.email ?? "",
          idioma: d.idioma === "es" ? "es" : "en",
          creadoAt: d.creadoAt ?? "",
          registered: d.registered === true,
          njallaName: typeof d.njallaName === "string" ? d.njallaName : null,
        });
      }
    } catch {
      /* línea corrupta: se ignora */
    }
  }
  return out;
}

async function writeAll(list: DomainIntent[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((d) => JSON.stringify(d)).join("\n");
  await writeFile(FILE, body ? body + "\n" : "", { encoding: "utf8", mode: 0o600 });
  await chmod(FILE, 0o600);
}

const misma = (a: DomainIntent, invoiceId: string, domain: string) =>
  a.invoiceId === invoiceId && a.domain.toLowerCase() === domain.toLowerCase();

/** Registra la intención. Idempotente por (invoiceId, domain). */
export async function registrarDomainIntent(input: NuevaDomainIntent): Promise<void> {
  const list = await readAll();
  if (list.some((d) => misma(d, input.invoiceId, input.domain))) return;
  list.push({
    ...input,
    domain: input.domain.toLowerCase(),
    creadoAt: new Date().toISOString(),
    registered: false,
    njallaName: null,
  });
  await writeAll(list);
}

/** Intenciones de una factura (las que el pago debe registrar). */
export async function intentsDeFactura(invoiceId: string): Promise<DomainIntent[]> {
  return (await readAll()).filter((d) => d.invoiceId === invoiceId);
}

/** Marca un dominio como ya registrado (idempotencia del registro). */
export async function marcarRegistrado(
  invoiceId: string,
  domain: string,
  njallaName: string,
): Promise<void> {
  const list = await readAll();
  let cambiado = false;
  const next = list.map((d) => {
    if (misma(d, invoiceId, domain) && !d.registered) {
      cambiado = true;
      return { ...d, registered: true, njallaName };
    }
    return d;
  });
  if (cambiado) await writeAll(next);
}

/** Intenciones de un usuario ya registradas (para el panel "Mis dominios"). */
export async function dominiosDeUsuario(userId: string): Promise<DomainIntent[]> {
  if (!userId) return [];
  return (await readAll()).filter((d) => d.userId === userId && d.registered);
}
