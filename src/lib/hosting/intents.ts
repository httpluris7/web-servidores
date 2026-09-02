import "server-only";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Intenciones de alta de hosting, ligadas a la factura (proforma).
 *
 * Mismo patrón que `domains/intents.ts` y `provisioner/intents.ts`: al hacer
 * checkout de un plan de hosting guardamos aquí, indexado por `invoiceId`, lo
 * necesario para crear la cuenta de cPanel (plan/paquete + dueño + correo).
 * Cuando la proforma pase a pagada (webhook de tarjeta o conciliador de
 * transferencia), se lee esto y se llama a WHM.
 *
 * Almacén JSONL (`data/hosting-intents.jsonl`), 0600, reescrito entero en cada
 * mutación (fichero diminuto). Unicidad: `(invoiceId, planId)`.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "hosting-intents.jsonl");

export type HostingIntent = {
  invoiceId: string;
  planId: string;
  /** Paquete de cPanel resuelto al hacer checkout (estable). */
  cpanelPackage: string;
  userId: string | null;
  email: string;
  nombre: string;
  idioma: "es" | "en";
  /** Dominio que el cliente quiere alojar (ya normalizado); null = temporal. */
  requestedDomain: string | null;
  creadoAt: string;
  /** ¿Ya se creó la cuenta en WHM? (idempotencia). */
  provisioned: boolean;
  /** Usuario de cPanel creado (confirmación). */
  cpanelUser: string | null;
  /** Dominio primario (temporal) con el que se creó la cuenta. */
  domain: string | null;
};

export type NuevaHostingIntent = Omit<
  HostingIntent,
  "creadoAt" | "provisioned" | "cpanelUser" | "domain"
>;

async function readAll(): Promise<HostingIntent[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: HostingIntent[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line) as Partial<HostingIntent>;
      if (typeof d.invoiceId === "string" && typeof d.planId === "string") {
        out.push({
          invoiceId: d.invoiceId,
          planId: d.planId,
          cpanelPackage: typeof d.cpanelPackage === "string" ? d.cpanelPackage : "",
          userId: typeof d.userId === "string" ? d.userId : null,
          email: d.email ?? "",
          nombre: d.nombre ?? "",
          idioma: d.idioma === "es" ? "es" : "en",
          requestedDomain: typeof d.requestedDomain === "string" ? d.requestedDomain : null,
          creadoAt: d.creadoAt ?? "",
          provisioned: d.provisioned === true,
          cpanelUser: typeof d.cpanelUser === "string" ? d.cpanelUser : null,
          domain: typeof d.domain === "string" ? d.domain : null,
        });
      }
    } catch {
      /* línea corrupta: se ignora */
    }
  }
  return out;
}

async function writeAll(list: HostingIntent[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((d) => JSON.stringify(d)).join("\n");
  await writeFile(FILE, body ? body + "\n" : "", { encoding: "utf8", mode: 0o600 });
  await chmod(FILE, 0o600);
}

const misma = (a: HostingIntent, invoiceId: string, planId: string) =>
  a.invoiceId === invoiceId && a.planId === planId;

/** Registra la intención. Idempotente por (invoiceId, planId). */
export async function registrarHostingIntent(input: NuevaHostingIntent): Promise<void> {
  const list = await readAll();
  if (list.some((d) => misma(d, input.invoiceId, input.planId))) return;
  list.push({
    ...input,
    creadoAt: new Date().toISOString(),
    provisioned: false,
    cpanelUser: null,
    domain: null,
  });
  await writeAll(list);
}

/** Intenciones de una factura (las que el pago debe aprovisionar). */
export async function intentsDeFactura(invoiceId: string): Promise<HostingIntent[]> {
  return (await readAll()).filter((d) => d.invoiceId === invoiceId);
}

/** Marca una cuenta como creada (idempotencia del alta). */
export async function marcarProvisionado(
  invoiceId: string,
  planId: string,
  cpanelUser: string,
  domain: string,
): Promise<void> {
  const list = await readAll();
  let cambiado = false;
  const next = list.map((d) => {
    if (misma(d, invoiceId, planId) && !d.provisioned) {
      cambiado = true;
      return { ...d, provisioned: true, cpanelUser, domain };
    }
    return d;
  });
  if (cambiado) await writeAll(next);
}

/** Cuentas de hosting ya creadas de un usuario (para "Mis servicios"). */
export async function hostingDeUsuario(userId: string): Promise<HostingIntent[]> {
  if (!userId) return [];
  return (await readAll()).filter((d) => d.userId === userId && d.provisioned);
}

/**
 * ¿Es esta cuenta de cPanel (usuario) de este usuario? Punto ÚNICO de
 * comprobación de propiedad para acciones sobre la cuenta (p. ej. resetear la
 * contraseña), como `usuarioTieneDominio` con el DNS. Una cuenta ajena se trata
 * como inexistente (404).
 */
export async function usuarioTieneHosting(userId: string, cpanelUser: string): Promise<boolean> {
  if (!userId || !cpanelUser) return false;
  return (await hostingDeUsuario(userId)).some((d) => d.cpanelUser === cpanelUser);
}
