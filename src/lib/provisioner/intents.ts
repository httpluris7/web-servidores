import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Intenciones de aprovisionamiento, ligadas a la factura (proforma).
 *
 * El problema que resuelve: el aprovisionamiento se dispara en el WEBHOOK de
 * pago, donde no hay sesión ni los datos del pedido (SO, hostname, ubicación,
 * dueño). Todo eso SÍ se conoce en el checkout, cuando se emite la proforma. Así
 * que al hacer checkout de un VPS aprovisionable guardamos aquí, indexado por
 * `invoiceId`, lo que hará falta para crear la máquina; el webhook lo lee cuando
 * la factura pasa a pagada y llama al provisioner.
 *
 * Almacén JSONL (`data/provision-intents.jsonl`), misma filosofía que
 * `despliegues.ts` y `servidores/store.ts`: sin dependencias, reescrito entero
 * en cada mutación (el fichero es diminuto), permisos 0600.
 *
 * Clave de unicidad: `(invoiceId, planSlug)` — una factura puede tener varias
 * líneas VPS de planes distintos, cada una su máquina.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "provision-intents.jsonl");

export type ProvisionIntent = {
  invoiceId: string;
  planSlug: string;
  /** Dueño (uid de sesión) o null si la compra fue anónima. */
  userId: string | null;
  email: string;
  locationSlug: string;
  osSlug: string;
  hostname: string | null;
  idioma: "es" | "en";
  creadoAt: string;
  /** order_id del provisioner una vez encolada la provisión (null hasta el pago). */
  provisionOrderId: number | null;
  /** ¿Ya se dio de alta la ficha de servidor gestionado para este VPS? */
  fichaCreada: boolean;
};

export type NuevaIntent = Omit<
  ProvisionIntent,
  "creadoAt" | "provisionOrderId" | "fichaCreada"
>;

async function readAll(): Promise<ProvisionIntent[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: ProvisionIntent[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line) as Partial<ProvisionIntent>;
      if (typeof d.invoiceId === "string" && typeof d.planSlug === "string") {
        out.push({
          invoiceId: d.invoiceId,
          planSlug: d.planSlug,
          userId: typeof d.userId === "string" ? d.userId : null,
          email: d.email ?? "",
          locationSlug: d.locationSlug ?? "",
          osSlug: d.osSlug ?? "",
          hostname: typeof d.hostname === "string" ? d.hostname : null,
          idioma: d.idioma === "en" ? "en" : "es",
          creadoAt: d.creadoAt ?? "",
          provisionOrderId:
            typeof d.provisionOrderId === "number" ? d.provisionOrderId : null,
          fichaCreada: d.fichaCreada === true,
        });
      }
    } catch {
      // Línea corrupta: se ignora.
    }
  }
  return out;
}

async function writeAll(list: ProvisionIntent[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((d) => JSON.stringify(d)).join("\n");
  await writeFile(FILE, body ? body + "\n" : "", { encoding: "utf8", mode: 0o600 });
  await chmod(FILE, 0o600);
}

const misma = (a: { invoiceId: string; planSlug: string }, invoiceId: string, planSlug: string) =>
  a.invoiceId === invoiceId && a.planSlug === planSlug;

/**
 * Registra la intención de aprovisionar. Idempotente por `(invoiceId, planSlug)`:
 * repetir el checkout de la misma proforma no la duplica.
 */
export async function registrarIntent(input: NuevaIntent): Promise<void> {
  const list = await readAll();
  if (list.some((d) => misma(d, input.invoiceId, input.planSlug))) return;
  list.push({
    ...input,
    creadoAt: new Date().toISOString(),
    provisionOrderId: null,
    fichaCreada: false,
  });
  await writeAll(list);
}

/** Intenciones de una factura (las que el webhook debe aprovisionar al pagar). */
export async function intentsDeFactura(invoiceId: string): Promise<ProvisionIntent[]> {
  return (await readAll()).filter((d) => d.invoiceId === invoiceId);
}

/** Marca una intención como ya encolada en el provisioner. */
export async function marcarProvisionado(
  invoiceId: string,
  planSlug: string,
  provisionOrderId: number,
): Promise<void> {
  const list = await readAll();
  let cambiado = false;
  const next = list.map((d) => {
    if (misma(d, invoiceId, planSlug) && d.provisionOrderId == null) {
      cambiado = true;
      return { ...d, provisionOrderId };
    }
    return d;
  });
  if (cambiado) await writeAll(next);
}

/**
 * Intenciones de un usuario ya provisionadas pero cuya ficha de servidor aún no
 * se ha creado. Las usa la reconciliación perezosa del área de cliente.
 */
export async function pendientesDeFicha(userId: string): Promise<ProvisionIntent[]> {
  return (await readAll()).filter(
    (d) => d.userId === userId && d.provisionOrderId != null && !d.fichaCreada,
  );
}

/**
 * Intención asociada a un pedido del provisioner (por su `provisionOrderId`).
 * Sirve para remontar del VPS a su factura (la cabecera comercial del panel).
 */
export async function intentByProvisionOrderId(orderId: number): Promise<ProvisionIntent | null> {
  return (await readAll()).find((d) => d.provisionOrderId === orderId) ?? null;
}

/** Marca que ya existe la ficha de servidor gestionado para esta intención. */
export async function marcarFichaCreada(invoiceId: string, planSlug: string): Promise<void> {
  const list = await readAll();
  let cambiado = false;
  const next = list.map((d) => {
    if (misma(d, invoiceId, planSlug) && !d.fichaCreada) {
      cambiado = true;
      return { ...d, fichaCreada: true };
    }
    return d;
  });
  if (cambiado) await writeAll(next);
}
