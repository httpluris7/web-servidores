import { readSettings, type BackupSettings } from "@/lib/ajustes";
import { construirBackup, nombreBackup } from "./crear";
import { cifrar, EXT_BACKUP } from "./cifrado";
import {
  dropboxBorrar,
  dropboxListar,
  dropboxSubir,
  sftpBorrar,
  sftpListar,
  sftpSubir,
} from "./destinos";
import {
  borrarLocal,
  guardarLocal,
  leerHistorial,
  listarLocales,
  registrar,
  rutaLocal,
  type EntradaHistorial,
  type ResultadoDestino,
} from "./historial";

/**
 * Orquestador de una copia de seguridad: construir → cifrar → repartir a los
 * destinos → registrar → purgar los antiguos. Lo usan tanto el botón "Copia
 * ahora" del panel como el planificador diario.
 *
 * Filosofía de fallos: cada destino se intenta por separado y su error se
 * guarda en el histórico, pero un destino caído no impide que los demás
 * reciban la copia. Solo es fallo total si no se pudo generar/cifrar el zip.
 */

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Conserva las `retain` copias más recientes y borra el resto (0 = no purgar). */
async function podar(
  nombres: string[],
  retain: number,
  borrar: (nombre: string) => Promise<void>
): Promise<void> {
  if (retain <= 0) return;
  // El nombre lleva la fecha, así que el orden lexicográfico es el cronológico.
  const ordenados = [...nombres].sort().reverse();
  for (const viejo of ordenados.slice(retain)) {
    await borrar(viejo).catch(() => {
      // que no se pueda purgar un fichero no debe tumbar el backup
    });
  }
}

export type ResultadoBackup = {
  ok: boolean;
  nombre: string;
  bytes: number;
  destinos: EntradaHistorial["destinos"];
  error?: string;
};

/**
 * Genera y envía una copia. `origen` distingue las manuales de las programadas
 * en el histórico. No lanza: cualquier problema vuelve en `ResultadoBackup`.
 */
export async function ejecutarBackup(origen: "manual" | "programado"): Promise<ResultadoBackup> {
  const { backup } = await readSettings();
  const nombre = nombreBackup(new Date(), EXT_BACKUP);

  const base: ResultadoBackup = { ok: false, nombre, bytes: 0, destinos: {} };

  if (!backup.passphrase) {
    const error = "No hay frase de cifrado configurada: sin ella no se genera ningún backup.";
    await registrar({ t: new Date().toISOString(), nombre, bytes: 0, origen, destinos: {}, ok: false, error });
    return { ...base, error };
  }

  const hayDestino = backup.keepLocal || backup.dropboxEnabled || backup.sftpEnabled;
  if (!hayDestino) {
    const error = "No hay ningún destino activo (ni copia local, ni Dropbox, ni SFTP).";
    await registrar({ t: new Date().toISOString(), nombre, bytes: 0, origen, destinos: {}, ok: false, error });
    return { ...base, error };
  }

  // 1) Construir y cifrar.
  let cifrado: Buffer;
  try {
    const { zip } = await construirBackup();
    cifrado = cifrar(zip, backup.passphrase);
  } catch (e) {
    const error = `No se pudo generar el backup: ${mensaje(e)}`;
    await registrar({ t: new Date().toISOString(), nombre, bytes: 0, origen, destinos: {}, ok: false, error });
    return { ...base, error };
  }
  const bytes = cifrado.length;

  // 2) Copia local (siempre en disco primero: es la fuente del scp del SFTP).
  const destinos: EntradaHistorial["destinos"] = {};
  let rutaFichero = "";
  try {
    rutaFichero = await guardarLocal(nombre, cifrado);
    if (backup.keepLocal) destinos.local = { ok: true };
  } catch (e) {
    if (backup.keepLocal) destinos.local = { ok: false, error: mensaje(e) };
  }

  // 3) Dropbox.
  if (backup.dropboxEnabled) {
    destinos.dropbox = await enviar(() => dropboxSubir(backup.dropbox, nombre, cifrado));
  }

  // 4) SFTP (necesita el fichero en disco).
  if (backup.sftpEnabled) {
    if (!rutaFichero) {
      destinos.sftp = { ok: false, error: "No hubo copia local que subir por SFTP." };
    } else {
      destinos.sftp = await enviar(() => sftpSubir(backup.sftp, rutaFichero, nombre));
    }
  }

  // 5) Purga de antiguos en cada destino que fue bien.
  await purgar(backup, destinos);

  // Si no se quería copia local, se borra tras usarla de fuente para el SFTP.
  if (!backup.keepLocal && rutaFichero) {
    await borrarLocal(nombre).catch(() => {});
  }

  const ok = Object.values(destinos).some((d) => d?.ok);
  await registrar({ t: new Date().toISOString(), nombre, bytes, origen, destinos, ok });
  return { ok, nombre, bytes, destinos };
}

async function enviar(fn: () => Promise<void>): Promise<ResultadoDestino> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

async function purgar(backup: BackupSettings, destinos: EntradaHistorial["destinos"]): Promise<void> {
  if (destinos.local?.ok || backup.keepLocal) {
    const locales = (await listarLocales()).map((f) => f.nombre);
    await podar(locales, backup.retain, borrarLocal);
  }
  if (destinos.dropbox?.ok) {
    try {
      const nombres = (await dropboxListar(backup.dropbox)).map((f) => f.nombre);
      await podar(nombres, backup.retain, (n) => dropboxBorrar(backup.dropbox, n));
    } catch {
      // la purga es best-effort
    }
  }
  if (destinos.sftp?.ok) {
    try {
      const nombres = (await sftpListar(backup.sftp)).map((f) => f.nombre);
      await podar(nombres, backup.retain, (n) => sftpBorrar(backup.sftp, n));
    } catch {
      // best-effort
    }
  }
}

/**
 * Prueba un destino sin generar backup: lista lo que ya hay. Sirve al botón
 * "Probar" del panel para validar credenciales antes de fiarse de ellas.
 */
export async function probarDestino(destino: "dropbox" | "sftp"): Promise<{ ok: boolean; copias?: number; error?: string }> {
  const { backup } = await readSettings();
  try {
    if (destino === "dropbox") {
      const l = await dropboxListar(backup.dropbox);
      return { ok: true, copias: l.length };
    }
    const l = await sftpListar(backup.sftp);
    return { ok: true, copias: l.length };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/** Re-exports que consumen la API y el planificador. */
export { leerHistorial, listarLocales, rutaLocal };
