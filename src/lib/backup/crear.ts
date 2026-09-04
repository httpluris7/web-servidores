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
 *   - el `.env` de la raíz (claves de sesión, ADMIN_EMAILS, tokens de arranque),
 *   - los VOLCADOS del host que deja `/usr/local/sbin/viahost-dumps` (root, cada
 *     hora por systemd) en `/var/backups/viahost-dumps/`: MariaDB completo
 *     (mailserver+roundcube), Postgres del provisioner y el Maildir de Dovecot.
 *     La app corre como `viahost` sin privilegios y no puede leer nada de eso
 *     directamente; el script root lo deja legible (0640 root:viahost) en una
 *     carpeta donde la app NO puede escribir. Van dentro del zip como `dumps/…`.
 *     (Hallazgo 7-01 de la auditoría 2026-09-03.)
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
/** Carpeta con los volcados del host (la deja root; ver cabecera). */
export const DUMPS_DIR = process.env.BACKUP_DUMPS_DIR || "/var/backups/viahost-dumps";
/** Ficheros de volcado que se esperan; el resto de la carpeta se ignora. */
const DUMPS_ESPERADOS = ["mariadb-all.sql.gz", "provisioner-pg.sql.gz", "maildir.tar.gz", "dumps-info.json"];

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

export type ResumenDumps = {
  /** Ficheros de volcado incluidos (nombres dentro de `dumps/`). */
  ficheros: string[];
  /** Ficheros esperados que faltan (p.ej. el timer aún no corrió o falló). */
  faltan: string[];
  /** Antigüedad del volcado más viejo incluido, en minutos (null si no hay). */
  edadMin: number | null;
  /** Contenido de `dumps-info.json` (estado por volcado según el script root). */
  info: Record<string, unknown> | null;
};

/**
 * Recoge los volcados del host. Nunca lanza: si la carpeta no existe (otro
 * servidor, entorno de desarrollo) el backup sale sin ellos y el resumen lo
 * deja claro en `faltan`, para que el panel lo avise en vez de fingir.
 */
async function recogerDumps(): Promise<{ entries: ZipEntry[]; resumen: ResumenDumps }> {
  const entries: ZipEntry[] = [];
  const ficheros: string[] = [];
  let masViejo: number | null = null;
  let info: Record<string, unknown> | null = null;
  for (const nombre of DUMPS_ESPERADOS) {
    const abs = path.join(DUMPS_DIR, nombre);
    try {
      const st = await stat(abs);
      if (!st.isFile()) continue;
      const data = await readFile(abs);
      entries.push({ name: `dumps/${nombre}`, data, date: st.mtime });
      ficheros.push(nombre);
      if (nombre.endsWith(".json")) {
        try {
          info = JSON.parse(data.toString("utf8")) as Record<string, unknown>;
        } catch {
          info = null;
        }
      } else if (masViejo === null || st.mtimeMs < masViejo) {
        masViejo = st.mtimeMs;
      }
    } catch {
      // no está: se refleja en `faltan`
    }
  }
  const faltan = DUMPS_ESPERADOS.filter((n) => !ficheros.includes(n) && !n.endsWith(".json"));
  const edadMin = masViejo === null ? null : Math.max(0, Math.round((Date.now() - masViejo) / 60000));
  return { entries, resumen: { ficheros, faltan, edadMin, info } };
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
  /** Volcados del host incluidos (MariaDB/Postgres/Maildir) y su antigüedad. */
  dumps: ResumenDumps;
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

  // Volcados del host (BBDD + correo), si root los ha dejado.
  const dumps = await recogerDumps();
  entries.push(...dumps.entries);
  ficheros.push(...dumps.resumen.ficheros.map((n) => `dumps/${n}`));

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
    version: 2,
    createdAt: new Date().toISOString(),
    host: hostname(),
    appVersion: await appVersion(),
    files: ficheros,
    bytes,
    dumps: dumps.resumen,
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
