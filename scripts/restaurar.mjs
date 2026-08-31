#!/usr/bin/env node
/**
 * Restauración de una copia de seguridad de viahost — el "un solo comando" para
 * revivir el servicio en otro servidor si el original se avería o perdemos el
 * acceso.
 *
 * Es AUTOCONTENIDO a propósito: usa solo Node (crypto/zlib/child_process), sin
 * dependencias ni el build de la app, porque corre en una máquina recién
 * levantada donde todavía no hay `node_modules` ni `.next`.
 *
 *   Receta de recuperación completa en un servidor nuevo:
 *     git clone <repo> web-servidores && cd web-servidores
 *     node scripts/restaurar.mjs <fuente>            # repone data/ y .env
 *     npm ci && npm run deploy                       # levanta la app
 *
 * Fuentes admitidas:
 *   - Un fichero local:   node scripts/restaurar.mjs ./viahost-backup-….vhbk
 *   - La última de Dropbox:
 *       node scripts/restaurar.mjs --dropbox --dropbox-token TOK [--dropbox-folder /viahost-backups]
 *       (o --dropbox-refresh R --dropbox-key K --dropbox-secret S)
 *   - La última de un SFTP:
 *       node scripts/restaurar.mjs --sftp --sftp-host H --sftp-user U --sftp-key ./id [--sftp-dir viahost-backups] [--sftp-port 22]
 *
 * La frase de cifrado va en --passphrase o en la variable BACKUP_PASSPHRASE
 * (si se omite, se pide por teclado). Sin ella el backup es ilegible.
 *
 * IMPORTANTE: el formato de descifrado tiene que coincidir con
 * `src/lib/backup/cifrado.ts`. Si cambias uno, cambia el otro.
 */

import { createDecipheriv, scryptSync } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/* ------------------------------ argumentos ------------------------------- */

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) o[key] = true;
      else {
        o[key] = next;
        i++;
      }
    } else o._.push(a);
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));

function morir(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function uso() {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 40).join("\n").replace(/^\s*\/\*\*?|\*\/?/gm, "").trim());
}

if (args.help || args.h) {
  uso();
  process.exit(0);
}

/* ------------------------- obtener el fichero .vhbk ---------------------- */

function ejecutar(bin, argv, opts = {}) {
  const r = spawnSync(bin, argv, { encoding: "buffer", ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${bin} salió con código ${r.status}: ${(r.stderr || "").toString().slice(0, 300)}`);
  }
  return r.stdout;
}

function sshOpts(keyPath, port) {
  return [
    "-i", keyPath,
    "-p", String(port || 22),
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ConnectTimeout=20",
  ];
}

async function dropboxLatestBytes() {
  let token = args["dropbox-token"];
  const folder = (args["dropbox-folder"] || "/viahost-backups").replace(/\/+$/, "");
  if (!token && args["dropbox-refresh"]) {
    const auth = Buffer.from(`${args["dropbox-key"]}:${args["dropbox-secret"]}`).toString("base64");
    const res = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: args["dropbox-refresh"] }),
    });
    if (!res.ok) morir(`Dropbox: no se pudo renovar el token (${res.status}).`);
    token = (await res.json()).access_token;
  }
  if (!token) morir("Dropbox: falta --dropbox-token o --dropbox-refresh/-key/-secret.");

  const list = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, recursive: false }),
  });
  if (!list.ok) morir(`Dropbox: no se pudo listar ${folder} (${list.status}).`);
  const entries = (await list.json()).entries.filter((e) => e[".tag"] === "file" && e.name.startsWith("viahost-backup-"));
  if (!entries.length) morir(`Dropbox: no hay copias en ${folder}.`);
  const nombre = args.file || entries.map((e) => e.name).sort().pop();
  console.log(`▸ Descargando de Dropbox: ${nombre}`);
  const dl = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": JSON.stringify({ path: `${folder}/${nombre}` }) },
  });
  if (!dl.ok) morir(`Dropbox: no se pudo descargar ${nombre} (${dl.status}).`);
  return Buffer.from(await dl.arrayBuffer());
}

function sftpLatestBytes() {
  const host = args["sftp-host"], user = args["sftp-user"], key = args["sftp-key"];
  const dir = (args["sftp-dir"] || "viahost-backups").replace(/\/+$/, "");
  const port = args["sftp-port"];
  if (!host || !user || !key) morir("SFTP: faltan --sftp-host, --sftp-user o --sftp-key.");
  if (!existsSync(key)) morir(`SFTP: no existe el fichero de clave ${key}.`);
  const destino = `${user}@${host}`;
  const ls = ejecutar("ssh", [...sshOpts(key, port), destino, `ls -1 '${dir}' 2>/dev/null || true`]).toString();
  const nombres = ls.split("\n").map((s) => s.trim()).filter((n) => n.startsWith("viahost-backup-"));
  if (!nombres.length) morir(`SFTP: no hay copias en ${dir}.`);
  const nombre = args.file || nombres.sort().pop();
  console.log(`▸ Descargando por SFTP: ${nombre}`);
  const tmp = mkdtempSync(path.join(tmpdir(), "vhbk-restore-"));
  const local = path.join(tmp, nombre);
  ejecutar("scp", [...sshOpts(key, port), `${destino}:${dir}/${nombre}`, local]);
  const datos = readFileSync(local);
  rmSync(tmp, { recursive: true, force: true });
  return datos;
}

async function obtenerBytes() {
  if (args.dropbox) return dropboxLatestBytes();
  if (args.sftp) return sftpLatestBytes();
  const fichero = args._[0];
  if (!fichero) {
    uso();
    morir("Indica un fichero .vhbk, o --dropbox, o --sftp.");
  }
  if (!existsSync(fichero)) morir(`No existe el fichero ${fichero}.`);
  console.log(`▸ Usando fichero local: ${fichero}`);
  return readFileSync(fichero);
}

/* ------------------------------ descifrado ------------------------------- */
/* Debe coincidir con src/lib/backup/cifrado.ts */

const MAGIC = Buffer.from("VHBK", "ascii");
const SCRYPT = { N: 16384, r: 8, p: 1 };

function descifrar(fichero, passphrase) {
  let o = 0;
  if (fichero.length < MAGIC.length + 1 + 16 + 12 + 16) morir("El fichero es demasiado corto para ser un backup.");
  if (!fichero.subarray(0, 4).equals(MAGIC)) morir("El fichero no es un backup de viahost (cabecera desconocida).");
  o += 4;
  const version = fichero[o]; o += 1;
  if (version !== 1) morir(`Versión de backup no soportada: ${version}.`);
  const salt = fichero.subarray(o, (o += 16));
  const iv = fichero.subarray(o, (o += 12));
  const tag = fichero.subarray(o, (o += 16));
  const cuerpo = fichero.subarray(o);
  const clave = scryptSync(passphrase, salt, 32, { ...SCRYPT });
  const decipher = createDecipheriv("aes-256-gcm", clave, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(cuerpo), decipher.final()]);
  } catch {
    morir("No se pudo descifrar: la frase de paso es incorrecta o el fichero está dañado.");
  }
}

/* -------------------------------- unzip ---------------------------------- */
/* Lee cabeceras locales en secuencia (el zip de lib/zip.ts guarda el tamaño en
   cada cabecera; no usa data descriptors), método 0 (guardado) u 8 (deflate). */

function descomprimir(zip) {
  const entradas = [];
  let p = 0;
  while (p + 4 <= zip.length && zip.readUInt32LE(p) === 0x04034b50) {
    const metodo = zip.readUInt16LE(p + 8);
    const compSize = zip.readUInt32LE(p + 18);
    const nameLen = zip.readUInt16LE(p + 26);
    const extraLen = zip.readUInt16LE(p + 28);
    const nombre = zip.subarray(p + 30, p + 30 + nameLen).toString("utf8");
    const inicio = p + 30 + nameLen + extraLen;
    const cuerpo = zip.subarray(inicio, inicio + compSize);
    const datos = metodo === 8 ? inflateRawSync(cuerpo) : Buffer.from(cuerpo);
    entradas.push({ nombre, datos });
    p = inicio + compSize;
  }
  if (!entradas.length) morir("El backup descifrado no contiene ficheros (¿zip corrupto?).");
  return entradas;
}

/* ------------------------------ escritura -------------------------------- */

function escribir(entradas, destino, force) {
  const dataDir = path.join(destino, "data");
  if (existsSync(dataDir) && readdirSync(dataDir).length > 0 && !force) {
    morir(`Ya existe un data/ con contenido en ${destino}. Usa --force para sobrescribirlo.`);
  }
  let nData = 0, env = false, manifest = null;
  for (const { nombre, datos } of entradas) {
    if (nombre === "manifest.json") {
      try { manifest = JSON.parse(datos.toString("utf8")); } catch {}
      continue;
    }
    let salida;
    if (nombre.startsWith("data/")) { salida = path.join(destino, nombre); nData++; }
    else if (nombre === "env/.env") { salida = path.join(destino, ".env"); env = true; }
    else continue; // rutas inesperadas: se ignoran por seguridad
    // Nunca escribir fuera de `destino` (defensa ante nombres con ../).
    const abs = path.resolve(salida);
    if (!abs.startsWith(path.resolve(destino) + path.sep)) morir(`Ruta insegura en el backup: ${nombre}`);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, datos, { mode: 0o600 });
    chmodSync(abs, 0o600);
  }
  return { nData, env, manifest };
}

/* ------------------------------ frase paso ------------------------------- */

function pedirFrase() {
  const env = process.env.BACKUP_PASSPHRASE;
  if (typeof args.passphrase === "string" && args.passphrase) return Promise.resolve(args.passphrase);
  if (env) return Promise.resolve(env);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Frase de cifrado del backup: ", (a) => { rl.close(); resolve(a); });
  });
}

/* --------------------------------- main ---------------------------------- */

async function main() {
  const destino = args.dest ? path.resolve(args.dest) : process.cwd();
  const bytes = await obtenerBytes();
  const frase = await pedirFrase();
  if (!frase) morir("Hace falta la frase de cifrado (--passphrase o BACKUP_PASSPHRASE).");
  console.log("▸ Descifrando…");
  const zip = descifrar(bytes, frase);
  console.log("▸ Descomprimiendo…");
  const entradas = descomprimir(zip);
  console.log(`▸ Escribiendo en ${destino}…`);
  const { nData, env, manifest } = escribir(entradas, destino, !!args.force);
  console.log(`\n✓ Restauración completada.`);
  console.log(`  · ${nData} ficheros en data/`);
  console.log(`  · .env: ${env ? "restaurado" : "no incluido en la copia"}`);
  if (manifest) {
    console.log(`  · copia del ${manifest.createdAt} (host ${manifest.host}, app ${manifest.appVersion})`);
  }
  console.log(`\n  Siguiente paso:  npm ci && npm run deploy\n`);
}

main().catch((e) => morir(e && e.message ? e.message : String(e)));
