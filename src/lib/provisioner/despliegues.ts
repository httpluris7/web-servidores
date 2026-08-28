import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Vinculación pedido-de-aprovisionamiento ↔ cliente.
 *
 * El provisioner identifica sus pedidos por un `order_id` numérico y solo
 * guarda el email del cliente, no NUESTRO id de usuario. Para que la pantalla
 * de despliegue en vivo sea privada —que un cliente no pueda ver el progreso
 * del pedido de otro probando números— guardamos aquí quién es el dueño de cada
 * pedido en el momento de dispararlo.
 *
 * Almacén JSONL (`data/despliegues.jsonl`), misma filosofía que
 * `lib/servidores/store.ts`: sin dependencias, reescribiendo en cada mutación.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "despliegues.jsonl");

export type Despliegue = {
  /** order_id del provisioner. */
  orderId: number;
  /** Cliente propietario (uid de sesión). */
  userId: string;
  creadoAt: string;
};

async function readAll(): Promise<Despliegue[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: Despliegue[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line) as Partial<Despliegue>;
      if (typeof d.orderId === "number" && typeof d.userId === "string") {
        out.push({ orderId: d.orderId, userId: d.userId, creadoAt: d.creadoAt ?? "" });
      }
    } catch {
      // Línea corrupta: se ignora.
    }
  }
  return out;
}

async function writeAll(list: Despliegue[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((d) => JSON.stringify(d)).join("\n");
  await writeFile(FILE, body ? body + "\n" : "", { encoding: "utf8", mode: 0o600 });
  await chmod(FILE, 0o600);
}

/**
 * Registra que `orderId` pertenece a `userId`. Idempotente: si ya existe con el
 * mismo dueño, no duplica; si existiera con otro dueño (no debería), no lo pisa.
 */
export async function registrarDespliegue(orderId: number, userId: string): Promise<void> {
  const list = await readAll();
  const ya = list.find((d) => d.orderId === orderId);
  if (ya) return;
  list.push({ orderId, userId, creadoAt: new Date().toISOString() });
  await writeAll(list);
}

/** ¿Es este pedido de aprovisionamiento de este usuario? */
export async function esDespliegueDeUsuario(orderId: number, userId: string): Promise<boolean> {
  const list = await readAll();
  return list.some((d) => d.orderId === orderId && d.userId === userId);
}

/** Despliegues de un usuario, del más reciente al más antiguo. */
export async function desplieguesDeUsuario(userId: string): Promise<Despliegue[]> {
  const list = await readAll();
  return list
    .filter((d) => d.userId === userId)
    .sort((a, b) => (b.creadoAt ?? "").localeCompare(a.creadoAt ?? ""));
}
