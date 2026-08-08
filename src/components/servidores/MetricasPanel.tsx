"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatear, GraficaSerie, PALETA, type Serie, type Unidad } from "./GraficaSerie";

/** Debe coincidir con `Rango` de `lib/servidores/metricas`. */
const RANGOS = ["1h", "6h", "24h", "7d", "30d"] as const;
type Rango = (typeof RANGOS)[number];

type Punto = {
  t: number;
  cpu: number | null;
  cpuMax?: number | null;
  memPct: number | null;
  memPctMax?: number | null;
  memUsadaMb: number | null;
  memTotalMb: number | null;
  swapPct: number | null;
  discoPct: number | null;
  discoUsadoGb: number | null;
  discoTotalGb: number | null;
  rxBps: number | null;
  rxBpsMax?: number | null;
  txBps: number | null;
  txBpsMax?: number | null;
  rxTotal: number | null;
  txTotal: number | null;
  carga1: number | null;
  procesos: number | null;
  uptime: number | null;
};

type Meta = {
  hostname: string | null;
  os: string | null;
  kernel: string | null;
  arch: string | null;
  vcpu: number | null;
  version: string | null;
  ip: string | null;
  ultimoAt: string | null;
  intervalo: number | null;
};

type Respuesta = {
  ok: boolean;
  rango: Rango;
  agenteActivo: boolean;
  hayDatos: boolean;
  resolucion: "min" | "hora";
  puntos: Punto[];
  meta: Meta | null;
  ultima: Punto | null;
};

/** Cada cuánto se relee mientras la pestaña está a la vista, en los rangos cortos. */
const REFRESCO_MS = 60_000;

/**
 * Panel de consumo de un servidor, alimentado por el agente instalado dentro
 * de la máquina.
 *
 * El mismo componente sirve al admin y al cliente: solo cambia el prefijo de la
 * API, y la comprobación de a quién pertenece el servidor la hace el backend en
 * su punto único de siempre. Duplicar la pantalla habría duplicado también el
 * riesgo de que una de las dos copias se quede sin ese control.
 */
export function MetricasPanel({
  id,
  ambito,
}: {
  id: string;
  ambito: "admin" | "cuenta";
}) {
  const t = useTranslations("metricas");
  const locale = useLocale();
  const [rango, setRango] = useState<Rango>("24h");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cargar = useCallback(
    async (r: Rango) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setCargando(true);
      try {
        const res = await fetch(`/api/${ambito}/servidores/${id}/metricas?rango=${r}`, {
          signal: ctrl.signal,
        });
        const json = (await res.json().catch(() => null)) as Respuesta | null;
        if (!res.ok || !json?.ok) {
          setError(t("errorLoad"));
          return;
        }
        setDatos(json);
        setError(null);
      } catch (err) {
        // Abortar al cambiar de rango no es un error que mostrar.
        if ((err as Error)?.name !== "AbortError") setError(t("errorLoad"));
      } finally {
        setCargando(false);
      }
    },
    [ambito, id, t]
  );

  useEffect(() => {
    void cargar(rango);
  }, [cargar, rango]);

  // Refresco automático solo en los rangos cortos: en 30 días, un minuto más no
  // cambia nada y no merece la petición.
  useEffect(() => {
    if (rango !== "1h" && rango !== "6h") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void cargar(rango);
    }, REFRESCO_MS);
    return () => clearInterval(timer);
  }, [cargar, rango]);

  // Estabilizado: si fuera `datos?.puntos ?? []`, el array vacío sería nuevo en
  // cada render y recalcularía todas las series sin que hayan cambiado.
  const puntos = useMemo(() => datos?.puntos ?? [], [datos]);
  const ts = useMemo(() => puntos.map((p) => p.t), [puntos]);
  const resolucion = datos?.resolucion ?? "min";

  const series = useMemo(() => {
    const col = (sel: (p: Punto) => number | null | undefined): (number | null)[] =>
      puntos.map((p) => sel(p) ?? null);
    return {
      cpu: [
        {
          clave: "cpu",
          nombre: t("cpu"),
          color: PALETA.verde,
          valores: col((p) => p.cpu),
          pico: resolucion === "hora" ? col((p) => p.cpuMax) : undefined,
        },
      ] satisfies Serie[],
      ram: [
        {
          clave: "ram",
          nombre: t("ram"),
          color: PALETA.azul,
          valores: col((p) => p.memPct),
          pico: resolucion === "hora" ? col((p) => p.memPctMax) : undefined,
        },
      ] satisfies Serie[],
      red: [
        {
          clave: "rx",
          nombre: t("down"),
          color: PALETA.verde,
          valores: col((p) => p.rxBps),
          pico: resolucion === "hora" ? col((p) => p.rxBpsMax) : undefined,
        },
        {
          clave: "tx",
          nombre: t("up"),
          color: PALETA.azul,
          valores: col((p) => p.txBps),
          pico: resolucion === "hora" ? col((p) => p.txBpsMax) : undefined,
        },
      ] satisfies Serie[],
      disco: [
        {
          clave: "disco",
          nombre: t("disk"),
          color: PALETA.ambar,
          valores: col((p) => p.discoPct),
        },
      ] satisfies Serie[],
    };
  }, [puntos, resolucion, t]);

  const ultima = datos?.ultima ?? null;
  const meta = datos?.meta ?? null;

  // Estados en los que no hay nada que pintar: se explican en vez de enseñar
  // cuatro marcos vacíos sin decir por qué.
  if (!cargando && datos && !datos.agenteActivo) {
    return <Aviso titulo={t("noAgentTitle")} texto={t(`noAgentBody.${ambito}`)} />;
  }
  if (!cargando && datos && !datos.hayDatos) {
    return <Aviso titulo={t("waitingTitle")} texto={t("waitingBody")} />;
  }

  return (
    <section className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
            <EstadoAgente meta={meta} locale={locale} t={t} />
          </p>
        </div>

        {/* Los filtros van en una sola fila, encima de todo lo que gobiernan. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("rangeLabel")}>
          {RANGOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRango(r)}
              aria-pressed={rango === r}
              className={
                "inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border px-3 py-2 font-mono text-xs transition-colors md:min-h-0 md:px-2.5 md:py-1 " +
                (rango === r
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]")
              }
            >
              {t(`range.${r}`)}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {/* Mientras recarga, la gráfica anterior se queda puesta y solo baja de
          opacidad: sin esqueletos ni saltos de maquetación. */}
      <div
        className={`grid gap-4 transition-opacity lg:grid-cols-2 ${
          cargando && datos ? "opacity-60" : ""
        }`}
      >
        <GraficaSerie
          titulo={t("cpu")}
          descripcion={resumen(puntos, (p) => p.cpu, "pct", ultima?.cpu ?? null, t)}
          ts={ts}
          series={series.cpu}
          unidad="pct"
          resolucion={resolucion}
          locale={locale}
          etiquetaVacia={t("empty")}
          etiquetaPico={t("peak")}
        />
        <GraficaSerie
          titulo={t("ram")}
          descripcion={
            ultima?.memTotalMb
              ? t("ramDetail", {
                  usada: gib(ultima.memUsadaMb),
                  total: gib(ultima.memTotalMb),
                  pct: formatear(ultima.memPct, "pct"),
                })
              : resumen(puntos, (p) => p.memPct, "pct", ultima?.memPct ?? null, t)
          }
          ts={ts}
          series={series.ram}
          unidad="pct"
          resolucion={resolucion}
          locale={locale}
          etiquetaVacia={t("empty")}
          etiquetaPico={t("peak")}
        />
        <GraficaSerie
          titulo={t("network")}
          descripcion={t("networkDetail", {
            down: formatear(ultima?.rxBps ?? null, "bps"),
            up: formatear(ultima?.txBps ?? null, "bps"),
          })}
          ts={ts}
          series={series.red}
          unidad="bps"
          resolucion={resolucion}
          locale={locale}
          etiquetaVacia={t("empty")}
          etiquetaPico={t("peak")}
        />
        <GraficaSerie
          titulo={t("disk")}
          descripcion={
            ultima?.discoTotalGb
              ? t("diskDetail", {
                  usado: formatear(ultima.discoUsadoGb, "gb"),
                  total: formatear(ultima.discoTotalGb, "gb"),
                  pct: formatear(ultima.discoPct, "pct"),
                })
              : resumen(puntos, (p) => p.discoPct, "pct", ultima?.discoPct ?? null, t)
          }
          ts={ts}
          series={series.disco}
          unidad="pct"
          resolucion={resolucion}
          locale={locale}
          etiquetaVacia={t("empty")}
          etiquetaPico={t("peak")}
        />
      </div>

      <Ficha ultima={ultima} meta={meta} t={t} />
    </section>
  );
}

/* --------------------------------- Piezas --------------------------------- */

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <p className="mt-1.5 text-sm whitespace-pre-line text-[var(--color-fg-muted)]">{texto}</p>
    </section>
  );
}

type Traductor = ReturnType<typeof useTranslations<"metricas">>;

function EstadoAgente({
  meta,
  locale,
  t,
}: {
  meta: Meta | null;
  locale: string;
  t: Traductor;
}) {
  if (!meta?.ultimoAt) return <>{t("waitingTitle")}</>;
  const desde = Date.now() - new Date(meta.ultimoAt).getTime();
  const vivo = desde < (meta.intervalo ?? 60) * 2.5 * 1000;
  const cuando = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(meta.ultimoAt));

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span
        aria-hidden="true"
        className={`inline-block size-1.5 rounded-full ${
          vivo ? "bg-[var(--color-accent)]" : "bg-[var(--color-danger)]"
        }`}
      />
      <span className={vivo ? "text-[var(--color-fg-muted)]" : "text-[var(--color-danger)]"}>
        {vivo ? t("agentLive") : t("agentStale")}
      </span>
      <span className="font-mono text-[var(--color-fg-dim)]">{cuando}</span>
      {meta.hostname && <span className="font-mono text-[var(--color-fg-dim)]">{meta.hostname}</span>}
    </span>
  );
}

/** Ficha de la máquina y valores que no son series: sistema, carga, procesos. */
function Ficha({
  ultima,
  meta,
  t,
}: {
  ultima: Punto | null;
  meta: Meta | null;
  t: Traductor;
}) {
  const filas: Array<[string, string]> = [];
  if (meta?.os) filas.push([t("fieldOs"), meta.os]);
  if (meta?.kernel) filas.push([t("fieldKernel"), `${meta.kernel}${meta.arch ? ` · ${meta.arch}` : ""}`]);
  if (meta?.vcpu) filas.push([t("fieldCpus"), String(meta.vcpu)]);
  if (ultima?.carga1 !== null && ultima?.carga1 !== undefined) {
    filas.push([t("fieldLoad"), ultima.carga1.toFixed(2)]);
  }
  if (ultima?.procesos !== null && ultima?.procesos !== undefined) {
    filas.push([t("fieldProcs"), String(ultima.procesos)]);
  }
  if (ultima?.swapPct !== null && ultima?.swapPct !== undefined) {
    filas.push([t("fieldSwap"), formatear(ultima.swapPct, "pct")]);
  }
  if (ultima?.uptime) filas.push([t("fieldUptime"), duracion(ultima.uptime, t)]);
  if (ultima?.rxTotal !== null && ultima?.rxTotal !== undefined) {
    filas.push([
      t("fieldTraffic"),
      `↓ ${bytes(ultima.rxTotal)} · ↑ ${bytes(ultima.txTotal ?? 0)}`,
    ]);
  }
  if (meta?.version) filas.push([t("fieldAgent"), `v${meta.version}`]);

  if (filas.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5">
      <h3 className="mono-label text-[0.6rem]">{t("machine")}</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {filas.map(([k, v]) => (
          <div key={k} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-[var(--color-line)] pb-1.5">
            <dt className="text-xs text-[var(--color-fg-muted)]">{k}</dt>
            <dd className="truncate font-mono text-xs text-[var(--color-fg)]" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------- Utilidades ------------------------------ */

/**
 * Resumen textual bajo cada título. No es decoración: deja el valor actual, la
 * media y el pico accesibles sin pasar el ratón por encima.
 */
function resumen(
  puntos: Punto[],
  sel: (p: Punto) => number | null,
  unidad: Unidad,
  actual: number | null,
  t: Traductor
): string {
  const vals = puntos.map(sel).filter((v): v is number => v !== null);
  if (vals.length === 0) return "";
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  const pico = Math.max(...vals);
  return t("summary", {
    now: formatear(actual, unidad),
    avg: formatear(media, unidad),
    peak: formatear(pico, unidad),
  });
}

const gib = (mb: number | null): string =>
  mb === null ? "—" : `${(mb / 1024).toFixed(mb < 10240 ? 1 : 0)} GB`;

function bytes(n: number): string {
  const u = ["B", "kB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1000 && i < u.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function duracion(segundos: number, t: Traductor): string {
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (d > 0) return t("uptimeDh", { d, h });
  if (h > 0) return t("uptimeHm", { h, m });
  return t("uptimeM", { m });
}
