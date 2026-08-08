import { appendFile, chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Métricas que envía el agente instalado dentro de cada VPS.
 *
 * Por qué existe esto: la API del proveedor solo da CPU instantánea, disco y
 * tráfico acumulado, y de las máquinas que no son suyas —los VPS de terceros—
 * no da absolutamente nada. Lo único que ve la RAM real de un servidor es algo
 * que corra dentro. El agente lee `/proc` y envía una muestra por minuto.
 *
 * Almacén de ficheros planos, sin dependencias, con la misma filosofía que
 * `lib/facturas.ts`. Dos resoluciones por servidor:
 *
 *   `<id>.jsonl`    muestras crudas del último día  (1/min · 26 h)
 *   `<id>.h.jsonl`  medias y picos por hora         (1/h  · 46 días)
 *
 * La resolución fina se trunca sola; la horaria se calcula al vuelo cuando el
 * reloj cruza de hora. Un servidor ocupa unos 250 KB en total, así que el
 * histórico no crece sin control por muchas máquinas que se den de alta.
 */

const DATA_DIR = path.join(process.cwd(), "data", "metricas");

/** Muestras crudas que se conservan: 26 h a una por minuto. */
const MAX_CRUDAS = 1560;
/** Reescribimos el fichero crudo solo cuando pasa de este tamaño. */
const TRIM_BYTES = 400 * 1024;
/** Horas que se conservan agregadas: 46 días. */
const MAX_HORAS = 1104;
/** Tope de una muestra en el cuerpo de la petición. */
export const MAX_CUERPO_BYTES = 8 * 1024;

/* ---------------------------------- Tipos --------------------------------- */

export type Muestra = {
  /** Marca de tiempo en segundos epoch (la pone el servidor, no el agente). */
  t: number;
  /** % de CPU ocupada, media del intervalo. */
  cpu: number | null;
  memPct: number | null;
  memUsadaMb: number | null;
  memTotalMb: number | null;
  swapPct: number | null;
  discoPct: number | null;
  discoUsadoGb: number | null;
  discoTotalGb: number | null;
  /** Bytes por segundo de media en el intervalo. */
  rxBps: number | null;
  txBps: number | null;
  /** Bytes acumulados desde el arranque, para el tráfico total del mes. */
  rxTotal: number | null;
  txTotal: number | null;
  carga1: number | null;
  procesos: number | null;
  /** Segundos encendido. */
  uptime: number | null;
};

/**
 * Punto de una serie. Los agregados horarios llevan además el pico de la hora:
 * una media de 60 minutos esconde justo lo que interesa ver —el minuto en que
 * la CPU se puso al 100%—, así que la gráfica pinta media y pico juntos.
 */
export type Punto = Muestra & {
  cpuMax?: number | null;
  memPctMax?: number | null;
  rxBpsMax?: number | null;
  txBpsMax?: number | null;
  /** Muestras que entraron en la media (para saber si la hora está completa). */
  n?: number;
};

/** Datos de la máquina que el agente reporta; cambian poco. */
export type MetaAgente = {
  hostname: string | null;
  os: string | null;
  kernel: string | null;
  arch: string | null;
  vcpu: number | null;
  /** Versión del agente, para saber a quién hay que actualizar. */
  version: string | null;
  /** IP desde la que llegó la última muestra; la vemos nosotros, no la envía. */
  ip: string | null;
  ultimoAt: string | null;
  /** Segundos entre muestras que dice usar el agente. */
  intervalo: number | null;
};

export type Rango = "1h" | "6h" | "24h" | "7d" | "30d";

export const RANGOS: Rango[] = ["1h", "6h", "24h", "7d", "30d"];

const SEGUNDOS: Record<Rango, number> = {
  "1h": 3600,
  "6h": 6 * 3600,
  "24h": 24 * 3600,
  "7d": 7 * 24 * 3600,
  "30d": 30 * 24 * 3600,
};

export function esRango(v: unknown): v is Rango {
  return typeof v === "string" && (RANGOS as string[]).includes(v);
}

/* -------------------------------- Ficheros -------------------------------- */

/**
 * Los ids vienen de `randomUUID`, pero este módulo recibe además ids que
 * llegan por la red. Comprobamos la forma antes de meterlos en una ruta: un
 * `../../` en el nombre escribiría fuera de `data/`.
 */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rutas(id: string): { crudo: string; horario: string; meta: string } | null {
  if (!ID_RE.test(id)) return null;
  return {
    crudo: path.join(DATA_DIR, `${id}.jsonl`),
    horario: path.join(DATA_DIR, `${id}.h.jsonl`),
    meta: path.join(DATA_DIR, `${id}.meta.json`),
  };
}

async function asegurarDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
}

async function leerLineas<T>(file: string): Promise<T[]> {
  let contenido: string;
  try {
    contenido = await readFile(file, "utf8");
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const linea of contenido.split("\n")) {
    if (!linea.trim()) continue;
    try {
      out.push(JSON.parse(linea) as T);
    } catch {
      // Línea a medio escribir: se ignora en vez de perder el histórico entero.
    }
  }
  return out;
}

async function escribirLineas(file: string, filas: unknown[]): Promise<void> {
  const cuerpo = filas.map((f) => JSON.stringify(f)).join("\n");
  await writeFile(file, cuerpo ? cuerpo + "\n" : "", { encoding: "utf8", mode: 0o600 });
  await chmod(file, 0o600);
}

/**
 * Candado por servidor.
 *
 * Recortar el fichero crudo y calcular la agregación horaria son operaciones de
 * leer-y-reescribir; si dos peticiones del mismo agente coincidieran, una
 * pisaría a la otra. Encadenar las operaciones por id lo cierra del todo y
 * cuesta un Map.
 */
const candados = new Map<string, Promise<unknown>>();

function conCandado<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const anterior = candados.get(id) ?? Promise.resolve();
  // `.then(fn, fn)` para que un fallo anterior no bloquee la cola para siempre.
  const resultado = anterior.then(fn, fn);
  // La cola nunca guarda una promesa rechazada: encadenar sobre ella dispararía
  // un unhandledRejection y dejaría el candado inservible.
  const cola = resultado.then(
    () => undefined,
    () => undefined
  );
  candados.set(id, cola);
  void cola.then(() => {
    // Si nadie ha encolado detrás, se libera la entrada del Map.
    if (candados.get(id) === cola) candados.delete(id);
  });
  return resultado;
}

/* ------------------------------- Saneamiento ------------------------------ */

/**
 * El agente corre en una máquina del cliente, así que lo que envía es entrada
 * no confiable: todo número se acota y todo texto se recorta. Un valor fuera de
 * rango se descarta (null) en vez de tumbar la muestra entera, que es peor:
 * perderíamos también los campos buenos.
 */
function numero(v: unknown, min: number, max: number, decimales = 0): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

function texto(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  // Fuera controles: esto acaba en el panel y en un fichero de líneas.
  const limpio = v.replace(/[\p{Cc}\p{Cf}]/gu, " ").trim().slice(0, max);
  return limpio || null;
}

const MB_MAX = 8 * 1024 * 1024; // 8 TiB expresados en MiB
const GB_MAX = 1024 * 1024; // 1 PiB en GiB
const BPS_MAX = 1e12;

/** Convierte lo que llega por la red en una muestra, o null si no hay nada útil. */
export function sanearMuestra(raw: unknown, t: number): Muestra | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const memUsadaMb = numero(r.memUsadaMb, 0, MB_MAX);
  const memTotalMb = numero(r.memTotalMb, 0, MB_MAX);
  const discoUsadoGb = numero(r.discoUsadoGb, 0, GB_MAX, 2);
  const discoTotalGb = numero(r.discoTotalGb, 0, GB_MAX, 2);

  const muestra: Muestra = {
    t,
    cpu: numero(r.cpu, 0, 100, 1),
    // El porcentaje lo calculamos nosotros cuando hay con qué: así no depende
    // de que el agente lo redondee bien y sale coherente con los absolutos.
    memPct:
      memUsadaMb !== null && memTotalMb !== null && memTotalMb > 0
        ? Math.round((memUsadaMb / memTotalMb) * 1000) / 10
        : numero(r.memPct, 0, 100, 1),
    memUsadaMb,
    memTotalMb,
    swapPct: numero(r.swapPct, 0, 100, 1),
    discoPct:
      discoUsadoGb !== null && discoTotalGb !== null && discoTotalGb > 0
        ? Math.round((discoUsadoGb / discoTotalGb) * 1000) / 10
        : numero(r.discoPct, 0, 100, 1),
    discoUsadoGb,
    discoTotalGb,
    rxBps: numero(r.rxBps, 0, BPS_MAX),
    txBps: numero(r.txBps, 0, BPS_MAX),
    rxTotal: numero(r.rxTotal, 0, Number.MAX_SAFE_INTEGER),
    txTotal: numero(r.txTotal, 0, Number.MAX_SAFE_INTEGER),
    carga1: numero(r.carga1, 0, 10000, 2),
    procesos: numero(r.procesos, 0, 1e6),
    uptime: numero(r.uptime, 0, 1e10),
  };

  // Si no vino ni un dato aprovechable, no guardamos una fila de nulos.
  const util =
    muestra.cpu !== null ||
    muestra.memPct !== null ||
    muestra.discoPct !== null ||
    muestra.rxBps !== null;
  return util ? muestra : null;
}

export function sanearMeta(raw: unknown, ip: string | null): Partial<MetaAgente> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    hostname: texto(r.hostname, 80),
    os: texto(r.os, 80),
    kernel: texto(r.kernel, 60),
    arch: texto(r.arch, 20),
    vcpu: numero(r.vcpu, 0, 4096),
    version: texto(r.version, 20),
    intervalo: numero(r.intervalo, 10, 3600),
    ip: texto(ip, 60),
    ultimoAt: new Date().toISOString(),
  };
}

/* -------------------------------- Escritura ------------------------------- */

/**
 * Última hora ya agregada por servidor, en memoria.
 *
 * Solo sirve para no releer los ficheros en cada muestra: si el proceso se
 * reinicia, el valor se pierde, se recalcula una vez y ya está. La verdad
 * siempre es el fichero horario, no este Map.
 */
const ultimaHoraAgregada = new Map<string, number>();

export async function guardarMuestra(
  id: string,
  muestra: Muestra,
  meta: Partial<MetaAgente>
): Promise<boolean> {
  const r = rutas(id);
  if (!r) return false;

  await conCandado(id, async () => {
    await asegurarDir();
    await appendFile(r.crudo, JSON.stringify(muestra) + "\n", { encoding: "utf8", mode: 0o600 });

    // Recorte solo cuando el fichero se pasa de tamaño: lo normal es no leerlo.
    try {
      const info = await stat(r.crudo);
      if (info.size > TRIM_BYTES) {
        const filas = await leerLineas<Muestra>(r.crudo);
        if (filas.length > MAX_CRUDAS) await escribirLineas(r.crudo, filas.slice(-MAX_CRUDAS));
      }
    } catch {
      // Si el recorte falla, la muestra ya está guardada: no es motivo de error.
    }

    const hora = Math.floor(muestra.t / 3600);
    if ((ultimaHoraAgregada.get(id) ?? -1) < hora) {
      await agregarHoras(id, r.crudo, r.horario, hora);
      ultimaHoraAgregada.set(id, hora);
    }

    await guardarMeta(r.meta, meta);
  });

  return true;
}

/**
 * Vuelca a la serie horaria las horas ya cerradas que aún no estén en ella.
 *
 * Solo se agregan horas COMPLETAS (estrictamente anteriores a la actual): una
 * hora a medias daría una media que cambiaría cada minuto y que además se
 * quedaría congelada al pasar a la siguiente.
 */
async function agregarHoras(
  id: string,
  crudo: string,
  horario: string,
  horaActual: number
): Promise<void> {
  const previas = await leerLineas<Punto>(horario);
  const ultima = previas.length > 0 ? Math.floor(previas[previas.length - 1]!.t / 3600) : -1;
  if (ultima >= horaActual - 1) return;

  const crudas = await leerLineas<Muestra>(crudo);
  if (crudas.length === 0) return;

  const cubos = new Map<number, Muestra[]>();
  for (const m of crudas) {
    const h = Math.floor(m.t / 3600);
    if (h >= horaActual || h <= ultima) continue;
    const cubo = cubos.get(h);
    if (cubo) cubo.push(m);
    else cubos.set(h, [m]);
  }
  if (cubos.size === 0) return;

  const nuevas = [...cubos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, ms]) => resumirHora(h, ms));

  await escribirLineas(horario, [...previas, ...nuevas].slice(-MAX_HORAS));
}

/** Media de la hora más el pico, que es lo que una media esconde. */
function resumirHora(hora: number, ms: Muestra[]): Punto {
  const media = (sel: (m: Muestra) => number | null, dec = 1): number | null => {
    const vals = ms.map(sel).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    const f = 10 ** dec;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * f) / f;
  };
  const pico = (sel: (m: Muestra) => number | null, dec = 1): number | null => {
    const vals = ms.map(sel).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    const f = 10 ** dec;
    return Math.round(Math.max(...vals) * f) / f;
  };
  // Los valores "de estado" (disco, totales, uptime) se toman del último, no
  // promediados: promediar un contador acumulado no significa nada.
  const ultimo = ms[ms.length - 1]!;

  return {
    t: hora * 3600,
    cpu: media((m) => m.cpu),
    cpuMax: pico((m) => m.cpu),
    memPct: media((m) => m.memPct),
    memPctMax: pico((m) => m.memPct),
    memUsadaMb: media((m) => m.memUsadaMb, 0),
    memTotalMb: ultimo.memTotalMb,
    swapPct: media((m) => m.swapPct),
    discoPct: ultimo.discoPct,
    discoUsadoGb: ultimo.discoUsadoGb,
    discoTotalGb: ultimo.discoTotalGb,
    rxBps: media((m) => m.rxBps, 0),
    rxBpsMax: pico((m) => m.rxBps, 0),
    txBps: media((m) => m.txBps, 0),
    txBpsMax: pico((m) => m.txBps, 0),
    rxTotal: ultimo.rxTotal,
    txTotal: ultimo.txTotal,
    carga1: media((m) => m.carga1, 2),
    procesos: media((m) => m.procesos, 0),
    uptime: ultimo.uptime,
    n: ms.length,
  };
}

async function guardarMeta(file: string, patch: Partial<MetaAgente>): Promise<void> {
  let actual: Partial<MetaAgente> = {};
  try {
    actual = JSON.parse(await readFile(file, "utf8")) as Partial<MetaAgente>;
  } catch {
    // Primera muestra de esta máquina.
  }
  // Un campo que el agente deja de mandar no borra el que ya teníamos.
  const fusion: Partial<MetaAgente> = { ...actual };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && v !== undefined) (fusion as Record<string, unknown>)[k] = v;
  }
  fusion.ultimoAt = patch.ultimoAt ?? new Date().toISOString();
  await writeFile(file, JSON.stringify(fusion), { encoding: "utf8", mode: 0o600 });
  await chmod(file, 0o600);
}

/* --------------------------------- Lectura -------------------------------- */

export type SerieMetricas = {
  /** true si alguna vez ha llegado una muestra de esta máquina. */
  hayDatos: boolean;
  /** "min" para los rangos cortos, "hora" para 7 y 30 días. */
  resolucion: "min" | "hora";
  puntos: Punto[];
  meta: MetaAgente | null;
  /** Última muestra recibida, aunque quede fuera del rango pedido. */
  ultima: Muestra | null;
};

const META_VACIA: MetaAgente = {
  hostname: null,
  os: null,
  kernel: null,
  arch: null,
  vcpu: null,
  version: null,
  ip: null,
  ultimoAt: null,
  intervalo: null,
};

export async function leerMetricas(id: string, rango: Rango): Promise<SerieMetricas> {
  const r = rutas(id);
  const vacio: SerieMetricas = {
    hayDatos: false,
    resolucion: "min",
    puntos: [],
    meta: null,
    ultima: null,
  };
  if (!r) return vacio;

  const horaria = rango === "7d" || rango === "30d";
  const desde = Math.floor(Date.now() / 1000) - SEGUNDOS[rango];

  const [crudas, horarias, meta] = await Promise.all([
    leerLineas<Muestra>(r.crudo),
    horaria ? leerLineas<Punto>(r.horario) : Promise.resolve<Punto[]>([]),
    leerMeta(r.meta),
  ]);

  // En 7d/30d la serie horaria no incluye la hora en curso: añadimos la media
  // de lo que llevamos de hora para que el último punto no falte.
  let puntos: Punto[];
  if (horaria) {
    const horaActual = Math.floor(Date.now() / 1000 / 3600);
    const enCurso = crudas.filter((m) => Math.floor(m.t / 3600) === horaActual);
    puntos = [...horarias, ...(enCurso.length > 0 ? [resumirHora(horaActual, enCurso)] : [])];
  } else {
    puntos = crudas;
  }

  return {
    hayDatos: crudas.length > 0 || horarias.length > 0,
    resolucion: horaria ? "hora" : "min",
    puntos: puntos.filter((p) => p.t >= desde).sort((a, b) => a.t - b.t),
    meta,
    ultima: crudas.length > 0 ? crudas[crudas.length - 1]! : null,
  };
}

async function leerMeta(file: string): Promise<MetaAgente | null> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as Partial<MetaAgente>;
    return { ...META_VACIA, ...raw };
  } catch {
    return null;
  }
}

/** Última muestra de varios servidores a la vez, para pintar el listado. */
export async function ultimasMuestras(
  ids: string[]
): Promise<Map<string, { ultima: Muestra; meta: MetaAgente | null }>> {
  const out = new Map<string, { ultima: Muestra; meta: MetaAgente | null }>();
  await Promise.all(
    ids.map(async (id) => {
      const r = rutas(id);
      if (!r) return;
      const [crudas, meta] = await Promise.all([
        leerLineas<Muestra>(r.crudo),
        leerMeta(r.meta),
      ]);
      const ultima = crudas[crudas.length - 1];
      if (ultima) out.set(id, { ultima, meta });
    })
  );
  return out;
}

/** Borra el histórico de un servidor. Se llama al borrar su ficha. */
export async function borrarMetricas(id: string): Promise<void> {
  const r = rutas(id);
  if (!r) return;
  await Promise.all([
    rm(r.crudo, { force: true }),
    rm(r.horario, { force: true }),
    rm(r.meta, { force: true }),
  ]);
  ultimaHoraAgregada.delete(id);
}

/**
 * ¿Se considera vivo el agente? Dos intervalos de margen: con uno, un minuto
 * de retraso ya lo pintaría de rojo.
 */
export function agenteVivo(meta: MetaAgente | null, ahora = Date.now()): boolean {
  if (!meta?.ultimoAt) return false;
  const margen = (meta.intervalo ?? 60) * 2.5 * 1000;
  return ahora - new Date(meta.ultimoAt).getTime() < margen;
}
