import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BackupDropbox, BackupSftp } from "@/lib/ajustes";

/**
 * Envío de las copias a un tercero. Dos destinos, la misma interfaz:
 * `subir`, `listar`, `borrar`. El orquestador (`run.ts`) los usa para mandar el
 * backup y para purgar los antiguos según la política de retención.
 *
 * Dropbox va por su API HTTPS (sin dependencias). El SFTP va por el `ssh`/`scp`
 * del sistema (como `mail.ts` usa el `sendmail` del sistema): cero dependencias
 * npm nuevas, a cambio de necesitar esos binarios en el host —que están—.
 */

export type ArchivoRemoto = { nombre: string; bytes: number };

/* ------------------------------- Dropbox --------------------------------- */

/**
 * Resuelve un token de acceso usable. Si hay refresh token + app, lo canjea
 * (los tokens de acceso de Dropbox caducan a las 4 h; el refresh no caduca).
 * Si solo hay un token de acceso directo, se usa tal cual (modo legacy).
 */
async function dropboxToken(cfg: BackupDropbox): Promise<string> {
  if (cfg.refreshToken && cfg.appKey && cfg.appSecret) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cfg.refreshToken,
    });
    const auth = Buffer.from(`${cfg.appKey}:${cfg.appSecret}`).toString("base64");
    const res = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Dropbox: no se pudo renovar el token (${res.status}).`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error("Dropbox: respuesta sin access_token.");
    return json.access_token;
  }
  if (cfg.accessToken) return cfg.accessToken;
  throw new Error("Dropbox: falta el token de acceso o el refresh token + app.");
}

/** Normaliza la carpeta a una ruta absoluta de Dropbox sin barra final. */
function dropboxCarpeta(folder: string): string {
  let f = (folder || "/viahost-backups").trim();
  if (!f.startsWith("/")) f = "/" + f;
  return f.replace(/\/+$/, "");
}

async function dropboxRpc<T>(token: string, url: string, arg: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Dropbox ${res.status}: ${detalle.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Sube un backup a Dropbox (un solo POST; los backups son pequeños). */
export async function dropboxSubir(cfg: BackupDropbox, nombre: string, datos: Buffer): Promise<void> {
  // El endpoint de un solo tiro admite hasta 150 MB; por encima haría falta
  // sesión de subida. Avisamos claro en vez de fallar con un 413 opaco.
  if (datos.length > 140 * 1024 * 1024) {
    throw new Error("Dropbox: el backup supera 140 MB; haría falta subida por sesión (no implementada).");
  }
  const token = await dropboxToken(cfg);
  const remoto = `${dropboxCarpeta(cfg.folder)}/${nombre}`;
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({ path: remoto, mode: "overwrite", autorename: false, mute: true }),
    },
    body: new Uint8Array(datos),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Dropbox: fallo al subir (${res.status}): ${detalle.slice(0, 200)}`);
  }
}

export async function dropboxListar(cfg: BackupDropbox): Promise<ArchivoRemoto[]> {
  const token = await dropboxToken(cfg);
  const carpeta = dropboxCarpeta(cfg.folder);
  const out: ArchivoRemoto[] = [];
  let resp = await dropboxRpc<{ entries: DbxEntry[]; has_more: boolean; cursor: string }>(
    token,
    "https://api.dropboxapi.com/2/files/list_folder",
    { path: carpeta, recursive: false }
  ).catch((e: Error) => {
    // Carpeta aún sin crear: no es un error, es que no hay copias todavía.
    if (/not_found/.test(e.message)) return { entries: [], has_more: false, cursor: "" };
    throw e;
  });
  for (;;) {
    for (const e of resp.entries) {
      if (e[".tag"] === "file" && e.name.startsWith("viahost-backup-")) {
        out.push({ nombre: e.name, bytes: e.size ?? 0 });
      }
    }
    if (!resp.has_more) break;
    resp = await dropboxRpc(token, "https://api.dropboxapi.com/2/files/list_folder/continue", {
      cursor: resp.cursor,
    });
  }
  return out;
}

type DbxEntry = { ".tag": string; name: string; size?: number };

export async function dropboxBorrar(cfg: BackupDropbox, nombre: string): Promise<void> {
  const token = await dropboxToken(cfg);
  const remoto = `${dropboxCarpeta(cfg.folder)}/${nombre}`;
  await dropboxRpc(token, "https://api.dropboxapi.com/2/files/delete_v2", { path: remoto });
}

/* --------------------------------- SFTP ---------------------------------- */

/** Ejecuta un binario capturando salida; rechaza con stderr si el código != 0. */
function ejecutar(bin: string, args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${bin} salió con código ${code}: ${err.trim().slice(0, 300)}`));
    });
    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

/**
 * Escribe la clave privada en un fichero temporal 0600, ejecuta `fn` con las
 * opciones de ssh ya montadas y borra la clave pase lo que pase. Nunca deja la
 * clave en disco más de lo imprescindible.
 */
async function conClave<T>(cfg: BackupSftp, fn: (sshOpts: string[], destino: string) => Promise<T>): Promise<T> {
  if (!cfg.host || !cfg.user) throw new Error("SFTP: faltan host o usuario.");
  if (!cfg.privateKey.trim()) throw new Error("SFTP: falta la clave privada.");
  const dir = await mkdtemp(path.join(tmpdir(), "vhbk-ssh-"));
  const keyFile = path.join(dir, "id");
  try {
    // La clave debe acabar en salto de línea o ssh la rechaza ("invalid format").
    const pem = cfg.privateKey.endsWith("\n") ? cfg.privateKey : cfg.privateKey + "\n";
    await writeFile(keyFile, pem, { mode: 0o600 });
    await chmod(keyFile, 0o600);
    const sshOpts = [
      "-i",
      keyFile,
      "-p",
      String(cfg.port),
      "-o",
      "BatchMode=yes", // nunca pide contraseña de forma interactiva; falla rápido
      "-o",
      "StrictHostKeyChecking=accept-new", // acepta el host la 1ª vez y lo fija
      "-o",
      "ConnectTimeout=20",
    ];
    return await fn(sshOpts, `${cfg.user}@${cfg.host}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Carpeta remota sin barra final; `.` si va vacía (home del usuario). */
function sftpDir(dir: string): string {
  const d = (dir || "").trim().replace(/\/+$/, "");
  return d || ".";
}

export async function sftpSubir(cfg: BackupSftp, ficheroLocal: string, nombre: string): Promise<void> {
  await conClave(cfg, async (sshOpts, destino) => {
    const dir = sftpDir(cfg.dir);
    // Crear la carpeta (idempotente) y subir con scp.
    await ejecutar("ssh", [...sshOpts, destino, `mkdir -p ${shArg(dir)}`]);
    await ejecutar("scp", [...sshOpts, ficheroLocal, `${destino}:${dir}/${nombre}`]);
  });
}

export async function sftpListar(cfg: BackupSftp): Promise<ArchivoRemoto[]> {
  return conClave(cfg, async (sshOpts, destino) => {
    const dir = sftpDir(cfg.dir);
    // `ls -l` para tener también el tamaño; si la carpeta no existe, lista vacía.
    const salida = await ejecutar("ssh", [
      ...sshOpts,
      destino,
      `ls -l ${shArg(dir)} 2>/dev/null || true`,
    ]);
    const out: ArchivoRemoto[] = [];
    for (const linea of salida.split("\n")) {
      // formato: -rw-r--r-- 1 user grp 12345 fecha nombre
      const m = linea.match(/\s(\d+)\s+\S+\s+\S+\s+\S+\s+(viahost-backup-\S+)$/);
      if (m) out.push({ nombre: m[2]!, bytes: Number(m[1]) });
    }
    return out;
  });
}

export async function sftpBorrar(cfg: BackupSftp, nombre: string): Promise<void> {
  await conClave(cfg, async (sshOpts, destino) => {
    const dir = sftpDir(cfg.dir);
    await ejecutar("ssh", [...sshOpts, destino, `rm -f ${shArg(dir)}/${shArg(nombre)}`]);
  });
}

/** Entrecomilla un argumento para pasarlo a un shell remoto sin sorpresas. */
function shArg(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
