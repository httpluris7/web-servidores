import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { site } from "@/data/site";
import { readSettings, type AlertSettings } from "@/lib/ajustes";
import { emailRe } from "@/lib/leads";
import { ALERT_FALLBACK_MAILBOX, sendAlertMail } from "@/lib/mail";
import { agenteVivo, ultimasMuestras, type Muestra } from "./metricas";
import { listManagedServers, type ManagedServer } from "./store";

/**
 * Avisos por umbral sobre las métricas del agente.
 *
 * Dos ideas gobiernan el diseño, ambas para que los avisos se sigan leyendo
 * dentro de seis meses:
 *
 * 1. **Un pico no es un problema.** CPU y memoria tienen que estar por encima
 *    del umbral de forma sostenida antes de avisar; si no, cualquier `apt
 *    upgrade` genera correo. El disco es la excepción: si está al 95%, lo está.
 * 2. **Ni un aviso por muestra.** El estado se guarda, así que se avisa al
 *    cruzar el umbral y se vuelve a avisar al recuperarse, no cada minuto. Y la
 *    vuelta a la normalidad exige bajar del umbral menos un margen, para que un
 *    valor bailando en el 90% no genere una pareja de correos por minuto.
 *
 * El estado vive en `data/avisos.json` para sobrevivir a los despliegues: si
 * estuviera en memoria, cada `npm run deploy` reavisaría de todo lo abierto.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "avisos.json");

/** Puntos porcentuales que hay que bajar del umbral para darlo por resuelto. */
const MARGEN = 5;

export type Regla = "cpu" | "memoria" | "disco" | "agente";

export const REGLAS: Regla[] = ["cpu", "memoria", "disco", "agente"];

export type EstadoRegla = {
  estado: "ok" | "alerta";
  /** Cuándo empezó a superarse el umbral (todavía sin avisar). */
  superandoDesde: string | null;
  /** Cuándo se dio por abierto el aviso. */
  desde: string | null;
  ultimoAvisoAt: string | null;
  /** Último valor observado, para poder pintarlo en el panel. */
  valor: number | null;
};

type EstadoServidor = Partial<Record<Regla, EstadoRegla>>;
type Almacen = Record<string, EstadoServidor>;

export type AvisoActivo = {
  servidorId: string;
  servidor: string;
  regla: Regla;
  valor: number | null;
  umbral: number;
  desde: string;
};

/* ------------------------------- Persistencia ----------------------------- */

/**
 * Todas las escrituras del estado pasan por esta cola.
 *
 * El barrido periódico y la llegada de una muestra pueden coincidir, y ambos
 * leen-modifican-escriben el MISMO fichero: sin serializar, uno perdería su
 * cambio y el aviso se repetiría o se quedaría colgado.
 */
let cola: Promise<unknown> = Promise.resolve();

function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = cola.then(fn, fn);
  cola = resultado.then(
    () => undefined,
    () => undefined
  );
  return resultado;
}

async function leer(): Promise<Almacen> {
  try {
    const raw = JSON.parse(await readFile(FILE, "utf8")) as unknown;
    return raw && typeof raw === "object" ? (raw as Almacen) : {};
  } catch {
    return {};
  }
}

async function escribir(estado: Almacen): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(estado), { encoding: "utf8", mode: 0o600 });
  await chmod(FILE, 0o600);
}

const VACIO: EstadoRegla = {
  estado: "ok",
  superandoDesde: null,
  desde: null,
  ultimoAvisoAt: null,
  valor: null,
};

/* --------------------------------- Reglas --------------------------------- */

/** Umbral configurado para cada regla; 0 significa desactivada. */
function umbral(cfg: AlertSettings, regla: Regla): number {
  if (regla === "cpu") return cfg.cpu;
  if (regla === "memoria") return cfg.memoria;
  if (regla === "disco") return cfg.disco;
  return cfg.agenteCaido;
}

export const ETIQUETA: Record<Regla, string> = {
  cpu: "CPU",
  memoria: "Memoria",
  disco: "Disco",
  agente: "Agente",
};

/** Destinatarios efectivos: los configurados o el buzón de administración. */
function destinatarios(cfg: AlertSettings): string[] {
  const lista = cfg.destinatarios
    .split(",")
    .map((s) => s.trim())
    .filter((s) => emailRe.test(s) && !/[<>,;"]/.test(s));
  return lista.length > 0 ? lista : [ALERT_FALLBACK_MAILBOX];
}

const fecha = (iso: string): string =>
  new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });

const pct = (v: number | null): string => (v === null ? "" : `${Math.round(v)} %`);

/* ------------------------------- Transiciones ----------------------------- */

type Transicion = {
  ficha: ManagedServer;
  regla: Regla;
  activa: boolean;
  valor: number | null;
  umbral: number;
  desde: string;
  recordatorio: boolean;
};

/**
 * Decide el estado nuevo de una regla y si toca avisar.
 *
 * `supera` ya viene resuelto por quien llama porque cada regla lo mide a su
 * manera: un porcentaje para CPU, memoria y disco, y minutos de silencio para
 * el agente.
 */
function transicion(
  actual: EstadoRegla,
  supera: boolean,
  valor: number | null,
  ahora: Date,
  sostenidoMin: number,
  recordatorioH: number
): { siguiente: EstadoRegla; avisar: "alerta" | "resuelto" | "recordatorio" | null } {
  const iso = ahora.toISOString();

  if (supera) {
    if (actual.estado === "alerta") {
      // Ya avisado: solo se repite si el recordatorio está activo y toca.
      const toca =
        recordatorioH > 0 &&
        actual.ultimoAvisoAt !== null &&
        ahora.getTime() - new Date(actual.ultimoAvisoAt).getTime() >= recordatorioH * 3600_000;
      return {
        siguiente: { ...actual, valor, ...(toca ? { ultimoAvisoAt: iso } : {}) },
        avisar: toca ? "recordatorio" : null,
      };
    }
    const desde = actual.superandoDesde ?? iso;
    const llevaSuperando = ahora.getTime() - new Date(desde).getTime();
    if (llevaSuperando < sostenidoMin * 60_000) {
      // Empezó a superarse pero aún no lleva el tiempo suficiente.
      return { siguiente: { ...actual, superandoDesde: desde, valor }, avisar: null };
    }
    return {
      siguiente: { estado: "alerta", superandoDesde: desde, desde, ultimoAvisoAt: iso, valor },
      avisar: "alerta",
    };
  }

  if (actual.estado === "alerta") {
    return {
      siguiente: { ...VACIO, valor },
      avisar: "resuelto",
    };
  }
  return { siguiente: { ...VACIO, valor }, avisar: null };
}

/** ¿El valor mantiene el aviso abierto? Con margen, para no oscilar. */
function sigueMal(estadoActual: EstadoRegla, valor: number, limite: number): boolean {
  return estadoActual.estado === "alerta" ? valor > limite - MARGEN : valor > limite;
}

/* -------------------------------- Evaluación ------------------------------ */

/**
 * Evalúa las reglas de porcentaje al llegar una muestra.
 *
 * Se llama desde la ingesta, así que el aviso sale en cuanto se cumple la
 * condición sin necesidad de ningún proceso aparte. Nunca lanza: un fallo
 * enviando correo no puede tumbar la ruta que guarda las métricas.
 */
export async function evaluarMuestra(ficha: ManagedServer, muestra: Muestra): Promise<void> {
  try {
    const { alerts } = await readSettings();
    if (!alerts.enabled) return;

    const valores: Array<[Regla, number | null, number]> = [
      ["cpu", muestra.cpu, alerts.cpu],
      ["memoria", muestra.memPct, alerts.memoria],
      ["disco", muestra.discoPct, alerts.disco],
    ];

    const transiciones = await enCola(async () => {
      const almacen = await leer();
      const previo = almacen[ficha.id] ?? {};
      const siguiente: EstadoServidor = { ...previo };
      const salida: Transicion[] = [];
      const ahora = new Date();

      for (const [regla, valor, limite] of valores) {
        if (limite <= 0 || valor === null) continue;
        const actual = previo[regla] ?? VACIO;
        const { siguiente: nuevo, avisar } = transicion(
          actual,
          sigueMal(actual, valor, limite),
          valor,
          ahora,
          // El disco no espera: si está lleno, esperar un cuarto de hora a
          // decirlo solo sirve para avisar más tarde de algo que ya pasó.
          regla === "disco" ? 0 : alerts.sostenido,
          alerts.recordatorio
        );
        siguiente[regla] = nuevo;
        if (avisar) {
          salida.push({
            ficha,
            regla,
            activa: avisar !== "resuelto",
            valor,
            umbral: limite,
            desde: nuevo.desde ?? actual.desde ?? ahora.toISOString(),
            recordatorio: avisar === "recordatorio",
          });
        }
      }

      // Si llega una muestra, el agente está vivo: se cierra su aviso aquí y no
      // hay que esperar al barrido.
      const agente = previo.agente;
      if (agente?.estado === "alerta") {
        siguiente.agente = { ...VACIO };
        salida.push({
          ficha,
          regla: "agente",
          activa: false,
          valor: null,
          umbral: alerts.agenteCaido,
          desde: agente.desde ?? ahora.toISOString(),
          recordatorio: false,
        });
      }

      almacen[ficha.id] = siguiente;
      await escribir(almacen);
      return salida;
    });

    await notificar(transiciones, alerts);
  } catch {
    // Vigilar no puede romper lo vigilado.
  }
}

/**
 * Busca agentes que han dejado de enviar.
 *
 * Esta regla no se puede evaluar al recibir una muestra, por el motivo obvio:
 * el síntoma es justo que no llega ninguna. Por eso hay un barrido periódico
 * ({@link src/instrumentation.ts}) que la comprueba.
 */
export async function barrerAgentesCaidos(): Promise<void> {
  try {
    const { alerts } = await readSettings();
    if (!alerts.enabled || alerts.agenteCaido <= 0) return;

    const fichas = (await listManagedServers()).filter((s) => s.agenteTokenHash !== null);
    if (fichas.length === 0) return;
    const muestras = await ultimasMuestras(fichas.map((s) => s.id));

    const transiciones = await enCola(async () => {
      const almacen = await leer();
      const salida: Transicion[] = [];
      const ahora = new Date();

      for (const ficha of fichas) {
        const dato = muestras.get(ficha.id);
        const ultimo = dato?.meta?.ultimoAt ?? null;
        // Un agente recién dado de alta que aún no ha enviado nada no está
        // caído: está esperando su primera muestra, y avisar de eso sería
        // avisar de que acabas de generar un token.
        if (!ultimo) continue;

        const minutosCallado = (ahora.getTime() - new Date(ultimo).getTime()) / 60_000;
        const actual = almacen[ficha.id]?.agente ?? VACIO;
        const { siguiente, avisar } = transicion(
          actual,
          minutosCallado >= alerts.agenteCaido,
          null,
          ahora,
          // El propio umbral ya es "lleva N minutos sin enviar": exigir además
          // que se sostenga sería pedir el doble de tiempo.
          0,
          alerts.recordatorio
        );

        almacen[ficha.id] = { ...(almacen[ficha.id] ?? {}), agente: siguiente };
        if (avisar) {
          salida.push({
            ficha,
            regla: "agente",
            activa: avisar !== "resuelto",
            valor: null,
            umbral: alerts.agenteCaido,
            desde: siguiente.desde ?? actual.desde ?? ahora.toISOString(),
            recordatorio: avisar === "recordatorio",
          });
        }
      }

      await escribir(almacen);
      return salida;
    });

    await notificar(transiciones, alerts);
  } catch {
    // Igual que arriba: el barrido falla en silencio y se reintenta al siguiente.
  }
}

async function notificar(transiciones: Transicion[], cfg: AlertSettings): Promise<void> {
  if (transiciones.length === 0) return;
  const to = destinatarios(cfg);

  for (const t of transiciones) {
    try {
      await sendAlertMail({
        to,
        servidor: t.ficha.etiqueta || t.ficha.host || t.ficha.id.slice(0, 8),
        metrica: ETIQUETA[t.regla],
        // El aviso del agente no tiene valor que enseñar, así que lleva su
        // propia frase para que el asunto se entienda de un vistazo.
        resumen: t.regla === "agente" ? "el agente ha dejado de enviar datos" : undefined,
        valor: t.regla === "agente" ? "" : pct(t.valor),
        umbral: t.regla === "agente" ? `${t.umbral} min sin enviar` : `${t.umbral} %`,
        desde: fecha(t.desde),
        url: `${site.url}/admin/servidores/${t.ficha.id}`,
        activa: t.activa,
        recordatorio: t.recordatorio,
      });
    } catch {
      // Un destinatario que rebota no debe impedir el resto de avisos.
    }
  }
}

/* ------------------------------ Lectura y limpieza ------------------------ */

/** Avisos abiertos ahora mismo, para pintarlos en el panel. */
export async function avisosActivos(): Promise<AvisoActivo[]> {
  const [{ alerts }, fichas, almacen] = await Promise.all([
    readSettings(),
    listManagedServers(),
    leer(),
  ]);
  const porId = new Map(fichas.map((f) => [f.id, f]));
  const out: AvisoActivo[] = [];

  for (const [id, reglas] of Object.entries(almacen)) {
    const ficha = porId.get(id);
    if (!ficha) continue;
    for (const regla of REGLAS) {
      const e = reglas[regla];
      if (!e || e.estado !== "alerta" || !e.desde) continue;
      out.push({
        servidorId: id,
        servidor: ficha.etiqueta || ficha.host || id.slice(0, 8),
        regla,
        valor: e.valor,
        umbral: umbral(alerts, regla),
        desde: e.desde,
      });
    }
  }
  return out.sort((a, b) => a.desde.localeCompare(b.desde));
}

/**
 * Olvida el estado de un servidor. Se llama al borrar su ficha y al revocar su
 * token: en ambos casos, dejar el estado sería dejar un aviso abierto que ya no
 * puede cerrarse nunca porque no volverán a llegar muestras.
 */
export async function olvidarAvisos(id: string): Promise<void> {
  await enCola(async () => {
    const almacen = await leer();
    if (!(id in almacen)) return;
    delete almacen[id];
    await escribir(almacen);
  });
}

/** ¿Está vivo el agente según su última meta? Reexportado por comodidad. */
export { agenteVivo };
