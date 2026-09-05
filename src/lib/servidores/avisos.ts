import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { site } from "@/data/site";
import { readSettings, type AlertSettings } from "@/lib/ajustes";
import { emailRe } from "@/lib/leads";
import { ALERT_FALLBACK_MAILBOX, sendAlertMail } from "@/lib/mail";
import { agenteVivo, ultimasMuestras, type Muestra } from "./metricas";
import { providerServers } from "./inventario";
import { listManagedServers, type ManagedServer } from "./store";
import { añadirLectura, trafico24h, GB, type Lectura } from "./trafico-calculo";

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

export type Regla = "cpu" | "memoria" | "disco" | "agente" | "trafico";

export const REGLAS: Regla[] = ["cpu", "memoria", "disco", "agente", "trafico"];

/** Prefijo del id de estado de un servidor del proveedor que aún no tiene ficha. */
export const ID_PROVEEDOR = "v4vm:";

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
  if (regla === "trafico") return cfg.traficoGbDia;
  return cfg.agenteCaido;
}

export const ETIQUETA: Record<Regla, string> = {
  cpu: "CPU",
  memoria: "Memoria",
  disco: "Disco",
  agente: "Agente",
  trafico: "Tráfico",
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

/** Lo que hace falta de un servidor para avisar: sirve la ficha o un servidor del proveedor sin ficha. */
type Avisable = Pick<ManagedServer, "id" | "etiqueta" | "host">;

type Transicion = {
  ficha: Avisable;
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

/* --------------------------- Tráfico del proveedor ------------------------ */

const TRAFICO_FILE = path.join(DATA_DIR, "trafico.json");

type TraficoServidor = { nombre: string; lecturas: Lectura[] };
type AlmacenTrafico = Record<string, TraficoServidor>;

async function leerTrafico(): Promise<AlmacenTrafico> {
  try {
    const raw = JSON.parse(await readFile(TRAFICO_FILE, "utf8")) as unknown;
    return raw && typeof raw === "object" ? (raw as AlmacenTrafico) : {};
  } catch {
    return {};
  }
}

async function escribirTrafico(estado: AlmacenTrafico): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TRAFICO_FILE, JSON.stringify(estado), { encoding: "utf8", mode: 0o600 });
  await chmod(TRAFICO_FILE, 0o600);
}

/** Histéresis del tráfico: se da por resuelto al bajar un 10 % del umbral. */
const MARGEN_TRAFICO = 0.1;

/**
 * Vigila el tráfico de los servidores del proveedor v4vm.
 *
 * La API del proveedor solo da contadores acumulados desde la creación, así
 * que cada barrido apunta la lectura y el tráfico "de las últimas 24 h" es la
 * diferencia con la lectura de hace un día (ver `trafico-calculo`). No se
 * juzga nada hasta tener 12 h de historial. El estado se guarda por ficha si
 * el servidor tiene una, y con el prefijo {@link ID_PROVEEDOR} si no la tiene:
 * un servidor sin asignar también puede estar desbocado.
 */
export async function barrerTrafico(): Promise<void> {
  try {
    const { alerts } = await readSettings();
    if (!alerts.enabled || alerts.traficoGbDia <= 0) return;

    const servidores = await providerServers();
    if (servidores.length === 0) return;
    const fichas = await listManagedServers();
    const fichaPorRemoto = new Map(fichas.filter((f) => f.proveedor === "v4vm").map((f) => [f.remoteId, f]));
    const ahora = new Date();
    const iso = ahora.toISOString();

    const transiciones = await enCola(async () => {
      const [almacen, trafico] = await Promise.all([leer(), leerTrafico()]);
      const salida: Transicion[] = [];
      const vistos = new Set<string>();

      for (const s of servidores) {
        const { trafficInBytes, trafficOutBytes } = s.usage;
        if (trafficInBytes === null && trafficOutBytes === null) continue;
        const clave = String(s.id);
        vistos.add(clave);
        const previo = trafico[clave]?.lecturas ?? [];
        const lecturas = añadirLectura(previo, { at: iso, bytes: (trafficInBytes ?? 0) + (trafficOutBytes ?? 0) });
        trafico[clave] = { nombre: s.name, lecturas };

        const bytes = trafico24h(lecturas, ahora);
        if (bytes === null) continue;
        const gb = bytes / GB;
        const ficha: Avisable = fichaPorRemoto.get(s.id) ?? {
          id: `${ID_PROVEEDOR}${clave}`,
          etiqueta: s.name,
          host: s.ipv4[0] ?? "",
        };
        const actual = almacen[ficha.id]?.trafico ?? VACIO;
        const limite = alerts.traficoGbDia;
        const supera = actual.estado === "alerta" ? gb > limite * (1 - MARGEN_TRAFICO) : gb > limite;
        // Sin "sostenido": el valor ya es un acumulado de 24 h, no un pico.
        const { siguiente, avisar } = transicion(actual, supera, gb, ahora, 0, alerts.recordatorio);
        almacen[ficha.id] = { ...(almacen[ficha.id] ?? {}), trafico: siguiente };
        if (avisar) {
          salida.push({
            ficha,
            regla: "trafico",
            activa: avisar !== "resuelto",
            valor: gb,
            umbral: limite,
            desde: siguiente.desde ?? actual.desde ?? iso,
            recordatorio: avisar === "recordatorio",
          });
        }
      }

      // Servidores que ya no están en el proveedor: fuera su historial y su estado.
      for (const clave of Object.keys(trafico)) {
        if (!vistos.has(clave)) {
          delete trafico[clave];
          delete almacen[`${ID_PROVEEDOR}${clave}`];
        }
      }

      await Promise.all([escribir(almacen), escribirTrafico(trafico)]);
      return salida;
    });

    await notificar(transiciones, alerts);
  } catch (err) {
    console.error("[avisos] barrido de tráfico fallido:", err instanceof Error ? err.message : err);
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
        valor: t.regla === "agente" ? "" : t.regla === "trafico" ? `${Math.round(t.valor ?? 0)} GB en 24 h` : pct(t.valor),
        umbral:
          t.regla === "agente"
            ? `${t.umbral} min sin enviar`
            : t.regla === "trafico"
              ? `${t.umbral} GB en 24 h`
              : `${t.umbral} %`,
        desde: fecha(t.desde),
        url: t.ficha.id.startsWith(ID_PROVEEDOR)
          ? `${site.url}/admin/servidores`
          : `${site.url}/admin/servidores/${t.ficha.id}`,
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
  const trafico = await leerTrafico();

  for (const [id, reglas] of Object.entries(almacen)) {
    const ficha: Avisable | undefined =
      porId.get(id) ??
      (id.startsWith(ID_PROVEEDOR) && trafico[id.slice(ID_PROVEEDOR.length)]
        ? { id, etiqueta: trafico[id.slice(ID_PROVEEDOR.length)]!.nombre, host: "" }
        : undefined);
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
