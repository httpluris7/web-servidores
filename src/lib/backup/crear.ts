import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { createZip, type ZipEntry } from "@/lib/zip";

/**
 * Construcción del contenido de una copia de seguridad.
 *
 * Qué entra (lo que NO está en git y hace falta para revivir el servicio en
 * otro servidor):
 *   - todo `data/` (JSONL de pedidos/usuarios/facturas/servidores, catálogo,
 *     métricas, avisos, ajustes.json con los secretos del panel…),
 *   - el `.env` de la raíz (claves de sesión, ADMIN_EMAILS, tokens de arranque).
 *
 * Qué NO entra:
 *   - el código (está en git: `git clone` + `npm run deploy` lo reponen),
 *   - `data/backups/` (las copias locales: no tiene sentido meter backups dentro
 *     de un backup),
 *   - ficheros temporales del propio backup (`*.tmp`, `*.part`).
 *
 * Todo se empaqueta en un ZIP en memoria (mismo `lib/zip.ts` que las facturas).
 * El volumen real de `data/` es de KB a unos pocos MB, así que cargarlo entero
 * en memoria es de sobra; si algún día `data/metricas/` se dispara, habría que
 * pasar a un tar en streaming, pero hoy sería más pieza que problema.
 */

const RAIZ = process.cwd();
const DATA_DIR = path.join(RAIZ, "data");
const ENV_FILE = path.join(RAIZ, ".env");

/** Subcarpeta de `data/` donde se guardan las copias locales; se excluye. */
export const LOCAL_BACKUP_DIRNAME = "backups";

function ignorar(rel: string): boolean {
  // Copias locales y temporales; nunca se meten dentro de un backup.
  if (rel === LOCAL_BACKUP_DIRNAME || rel.startsWith(LOCAL_BACKUP_DIRNAME + "/")) return true;
  if (rel.endsWith(".tmp") || rel.endsWith(".part")) return true;
  return false;
}

/** Recorre `data/` recogiendo cada fichero como entrada de zip (`data/<rel>`). */
async function recogerData(): Promise<{ entries: ZipEntry[]; ficheros: string[] }> {
  const entries: ZipEntry[] = [];
  const ficheros: string[] = [];

  async function andar(dir: string, relBase: string): Promise<void> {
    let items: import("node:fs").Dirent[];
    try {
      items = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // sin data/ todavía (instalación nueva): backup vacío de datos
    }
    for (const it of items) {
      const rel = relBase ? `${relBase}/${it.name}` : it.name;
      if (ignorar(rel)) continue;
      const abs = path.join(dir, it.name);
      if (it.isDirectory()) {
        await andar(abs, rel);
      } else if (it.isFile()) {
        const data = await readFile(abs);
        const st = await stat(abs);
        entries.push({ name: `data/${rel}`, data, date: st.mtime });
        ficheros.push(`data/${rel}`);
      }
    }
  }

  await andar(DATA_DIR, "");
  return { entries, ficheros };
}

export type BackupManifest = {
  /** Formato del manifiesto, por si cambia. */
  version: number;
  /** Marca de tiempo de creación (ISO, UTC). */
  createdAt: string;
  /** Host donde se generó, para saber de dónde viene una copia suelta. */
  host: string;
  /** Versión de la app (de package.json), informativa. */
  appVersion: string;
  /** Lista de ficheros incluidos (rutas dentro del zip). */
  files: string[];
  /** Tamaño total del contenido sin comprimir, en bytes. */
  bytes: number;
};

async function appVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(path.join(RAIZ, "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "?";
  } catch {
    return "?";
  }
}

/**
 * Genera el ZIP (en claro) de una copia de seguridad y su manifiesto. El cifrado
 * es un paso aparte (`cifrado.ts`) para poder probar el empaquetado sin frase.
 */
export async function construirBackup(): Promise<{ zip: Buffer; manifest: BackupManifest }> {
  const { entries, ficheros } = await recogerData();

  // El `.env` de la raíz, si existe, como `env/.env` dentro del zip.
  let envIncluido = false;
  try {
    const env = await readFile(ENV_FILE);
    const st = await stat(ENV_FILE);
    entries.push({ name: "env/.env", data: env, date: st.mtime });
    ficheros.push("env/.env");
    envIncluido = true;
  } catch {
    // sin .env (p.ej. todo por variables del sistema): no es un error
  }
  void envIncluido;

  const bytes = entries.reduce((n, e) => n + e.data.length, 0);
  const manifest: BackupManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    host: hostname(),
    appVersion: await appVersion(),
    files: ficheros,
    bytes,
  };

  // El manifiesto va el primero para poder inspeccionarlo sin descomprimir todo.
  entries.unshift({
    name: "manifest.json",
    data: Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8"),
  });

  return { zip: createZip(entries), manifest };
}

/**
 * Nombre de fichero de un backup, ordenable por fecha:
 * `viahost-backup-2026-08-31T0300Z.vhbk`. La `Z` deja claro que es UTC.
 */
export function nombreBackup(date = new Date(), ext = ".vhbk"): string {
  const iso = date.toISOString().replace(/[:.]/g, "").replace(/(\d{8})T(\d{6}).*/, "$1T$2");
  // iso queda como 20260831T030000 → lo formateamos legible
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  void iso;
  return `viahost-backup-${y}-${mo}-${d}T${h}${mi}Z${ext}`;
}
