import { chmod, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_BACKUP_DIRNAME } from "./crear";

/**
 * Registro y copia local de las copias de seguridad.
 *
 *  - `data/backups/` guarda los `.vhbk` locales (si `keepLocal`), fuera del zip
 *    del backup para no meter copias dentro de copias.
 *  - `data/backups.jsonl` es el histórico de ejecuciones que pinta el panel:
 *    una línea por intento, con el resultado de cada destino.
 *
 * Todo con permisos 0600: los `.vhbk` van cifrados, pero aun así no tienen por
 * qué ser legibles por otros usuarios del servidor.
 */

const DATA_DIR = path.join(process.cwd(), "data");
export const LOCAL_DIR = path.join(DATA_DIR, LOCAL_BACKUP_DIRNAME);
const LOG_FILE = path.join(DATA_DIR, "backups.jsonl");

export type ResultadoDestino = { ok: boolean; error?: string };

export type EntradaHistorial = {
  /** Marca de tiempo del intento (ISO). */
  t: string;
  /** Nombre del fichero de backup. */
  nombre: string;
  /** Tamaño del backup cifrado, en bytes. */
  bytes: number;
  /** ¿Manual (desde el panel) o programado? */
  origen: "manual" | "programado";
  /** Resultado por destino (solo los configurados). */
  destinos: Partial<Record<"local" | "dropbox" | "sftp", ResultadoDestino>>;
  /** true si al menos un destino recibió la copia. */
  ok: boolean;
  /** Error global (p.ej. no se pudo ni generar el zip). */
  error?: string;
};

/* ------------------------------ Copia local ------------------------------ */

export async function guardarLocal(nombre: string, datos: Buffer): Promise<string> {
  await mkdir(LOCAL_DIR, { recursive: true });
  const destino = path.join(LOCAL_DIR, nombre);
  await writeFile(destino, datos, { mode: 0o600 });
  await chmod(destino, 0o600);
  return destino;
}

export async function listarLocales(): Promise<{ nombre: string; bytes: number; mtime: string }[]> {
  let items: string[];
  try {
    items = await readdir(LOCAL_DIR);
  } catch {
    return [];
  }
  const out: { nombre: string; bytes: number; mtime: string }[] = [];
  for (const nombre of items) {
    if (!nombre.startsWith("viahost-backup-")) continue;
    try {
      const st = await stat(path.join(LOCAL_DIR, nombre));
      out.push({ nombre, bytes: st.size, mtime: st.mtime.toISOString() });
    } catch {
      // ignorar entradas que desaparecen entre readdir y stat
    }
  }
  return out.sort((a, b) => (a.nombre < b.nombre ? 1 : -1)); // más recientes primero
}

export async function borrarLocal(nombre: string): Promise<void> {
  // El nombre viene siempre de nuestro propio listado; aun así lo acotamos a la
  // carpeta de backups para no borrar nunca fuera de ahí.
  const base = path.basename(nombre);
  if (base !== nombre || !base.startsWith("viahost-backup-")) return;
  await rm(path.join(LOCAL_DIR, base), { force: true });
}

export function rutaLocal(nombre: string): string {
  return path.join(LOCAL_DIR, path.basename(nombre));
}

/* ------------------------------- Histórico ------------------------------- */

export async function registrar(entrada: EntradaHistorial): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(LOG_FILE, "", { mode: 0o600, flag: "a" });
  await chmod(LOG_FILE, 0o600);
  await writeFile(LOG_FILE, JSON.stringify(entrada) + "\n", { flag: "a", mode: 0o600 });
}

/** Últimas `limite` ejecuciones, más recientes primero. */
export async function leerHistorial(limite = 30): Promise<EntradaHistorial[]> {
  let texto: string;
  try {
    texto = await readFile(LOG_FILE, "utf8");
  } catch {
    return [];
  }
  const lineas = texto.split("\n").filter(Boolean);
  const out: EntradaHistorial[] = [];
  for (const l of lineas.slice(-limite)) {
    try {
      out.push(JSON.parse(l) as EntradaHistorial);
    } catch {
      // línea corrupta: se ignora en vez de tumbar el panel
    }
  }
  return out.reverse();
}

/** El último intento correcto (para "última copia" en el panel), o null. */
export async function ultimoOk(): Promise<EntradaHistorial | null> {
  const h = await leerHistorial(100);
  return h.find((e) => e.ok) ?? null;
}
