import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSettings } from "@/lib/ajustes";
import { ejecutarBackup } from "./run";

/**
 * Disparo de la copia diaria. Igual que el barrido de agentes caídos, vive en
 * el proceso (pm2 en modo fork, una sola instancia) en vez de en un cron
 * externo: si algún día hay varias réplicas habría que sacarlo fuera con un
 * candado compartido, pero hoy sería más pieza que problema.
 *
 * El estado —qué día se hizo la última copia— va en disco, no en memoria, para
 * que un `npm run deploy` (que reinicia el proceso) no dispare otra copia el
 * mismo día ni se salte la del día.
 */

const ESTADO_FILE = path.join(process.cwd(), "data", "backup-estado.json");

type Estado = { lastRun: string; lastAttempt?: string };

async function leerEstado(): Promise<Estado> {
  try {
    return JSON.parse(await readFile(ESTADO_FILE, "utf8")) as Estado;
  } catch {
    return { lastRun: "" };
  }
}

async function escribirEstado(estado: Estado): Promise<void> {
  await mkdir(path.dirname(ESTADO_FILE), { recursive: true });
  await writeFile(ESTADO_FILE, "", { mode: 0o600, flag: "a" });
  await chmod(ESTADO_FILE, 0o600);
  await writeFile(ESTADO_FILE, JSON.stringify(estado) + "\n", { mode: 0o600 });
}

/** Fecha local YYYY-MM-DD (el "hoy" del planificador, en hora del servidor). */
function hoyLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Candado en memoria: que dos comprobaciones solapadas no lancen dos copias. */
let enMarcha = false;

/**
 * Comprueba si toca copia y, si toca, la ejecuta. Se llama cada pocos minutos.
 * Es "catch-up": si el servidor estuvo apagado a la hora prevista y arranca más
 * tarde el mismo día, la copia se hace igualmente al primer chequeo posterior.
 */
export async function comprobarBackupDiario(): Promise<void> {
  if (enMarcha) return;
  const { backup } = await readSettings();
  if (!backup.enabled) return;

  const ahora = new Date();
  if (ahora.getHours() < backup.hour) return; // aún no es la hora de hoy

  const estado = await leerEstado();
  const hoy = hoyLocal(ahora);
  if (estado.lastRun === hoy) return; // ya se hizo hoy

  enMarcha = true;
  try {
    // Marcamos el intento ANTES de ejecutar: aunque la copia falle en todos los
    // destinos, no queremos reintentarla en bucle cada 5 min el resto del día.
    await escribirEstado({ lastRun: hoy, lastAttempt: ahora.toISOString() });
    await ejecutarBackup("programado");
  } catch {
    // ejecutarBackup no lanza; este catch es solo por si algo raro sube.
  } finally {
    enMarcha = false;
  }
}
