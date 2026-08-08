"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Gráfica de series temporales en SVG, sin librerías.
 *
 * Se dibuja a mano por la misma razón que el zip de las facturas: meter una
 * librería de gráficas (y sus dependencias) en un proyecto que vive con cuatro
 * no compensa para cuatro áreas y una línea.
 *
 * Decisiones que no son de gusto:
 * - Los huecos se dibujan como huecos. Si el agente estuvo caído dos horas, unir
 *   los dos extremos con una recta contaría una subida suave que no ocurrió.
 * - En la vista de 7 y 30 días la banda clara es el PICO de cada hora y la línea
 *   la media: una media horaria esconde justo lo que se busca al mirar, que es
 *   el minuto en que la CPU se puso al 100%.
 * - Un solo eje. Dos magnitudes distintas van en dos gráficas, nunca en una con
 *   dos escalas.
 */

export type Serie = {
  clave: string;
  nombre: string;
  /** Color del trazo. Del conjunto validado de `PALETA`. */
  color: string;
  valores: (number | null)[];
  /** Máximo del cubo, solo en resolución horaria. */
  pico?: (number | null)[];
};

export type Unidad = "pct" | "bps" | "gb" | "num";

/**
 * Paleta de series, validada sobre el fondo #0a0e17 (banda de luminosidad,
 * suelo de croma, separación con daltonismo protán/deután y contraste). El
 * orden importa: es el que se comprobó por pares adyacentes, así que las
 * series se asignan siempre en este orden y nunca se rota.
 */
export const PALETA = {
  verde: "#10ac79",
  azul: "#0795fd",
  ambar: "#c8800d",
  violeta: "#b767ec",
} as const;

/**
 * El lienzo se escala al ancho disponible, así que sus unidades no son píxeles:
 * en dos columnas la gráfica mide unos 440 px reales. Con un lienzo de 720 el
 * texto de los ejes acababa dibujándose a 6 px y no había quien lo leyera. Con
 * 480 la escala queda cerca de 1 y las etiquetas se leen también en el móvil.
 */
const W = 480;
const H = 170;
const PAD = { top: 10, right: 12, bottom: 20, left: 48 };
/** Tamaño del texto de los ejes, en unidades del lienzo. */
const FUENTE = 11;
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/* ------------------------------- Formateo --------------------------------- */

export function formatear(v: number | null, unidad: Unidad): string {
  if (v === null || !Number.isFinite(v)) return "—";
  switch (unidad) {
    case "pct":
      return `${v.toFixed(v < 10 ? 1 : 0)} %`;
    case "bps":
      return `${escala(v, ["B", "kB", "MB", "GB", "TB"], 1000)}/s`;
    case "gb":
      return `${v.toFixed(v < 10 ? 2 : 1)} GB`;
    default:
      return v.toLocaleString();
  }
}

/**
 * Igual que `formatear`, pero para las marcas del eje: sin el «/s» del tráfico.
 * Con él, «265 kB/s» no cabía en el margen izquierdo y se salía del lienzo; la
 * unidad ya la dice el resumen del título, así que repetirla en cada marca no
 * aporta nada y sí cuesta ancho de gráfica.
 */
function formatearEje(v: number | null, unidad: Unidad): string {
  if (unidad === "bps" && v !== null && Number.isFinite(v)) {
    return escala(v, ["B", "kB", "MB", "GB", "TB"], 1000);
  }
  return formatear(v, unidad);
}

function escala(n: number, u: string[], base: number): string {
  let v = n;
  let i = 0;
  while (v >= base && i < u.length - 1) {
    v /= base;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}

/** Techo redondeado a algo legible, para que las guías caigan en números limpios. */
function techo(max: number, unidad: Unidad): number {
  if (unidad === "pct") return 100;
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const paso = 10 ** exp;
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (max <= paso * m) return paso * m;
  }
  return paso * 10;
}

/* --------------------------------- Trazado -------------------------------- */

type Punto = { x: number; y: number };

/**
 * Convierte los valores en tramos continuos. Un null, o un salto de tiempo
 * mayor que el esperado, cierra el tramo en curso y abre otro.
 */
function tramos(
  valores: (number | null)[],
  ts: number[],
  escalaX: (t: number) => number,
  escalaY: (v: number) => number,
  saltoMax: number
): Punto[][] {
  const out: Punto[][] = [];
  let actual: Punto[] = [];
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i];
    const t = ts[i];
    const anterior = ts[i - 1];
    const hayHueco = anterior !== undefined && t !== undefined && t - anterior > saltoMax;
    if (v === null || v === undefined || t === undefined || hayHueco) {
      if (actual.length > 0) out.push(actual);
      actual = [];
      if (v === null || v === undefined || t === undefined) continue;
    }
    actual.push({ x: escalaX(t), y: escalaY(v) });
  }
  if (actual.length > 0) out.push(actual);
  return out;
}

const linea = (p: Punto[]): string =>
  p.map((q, i) => `${i === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");

const area = (p: Punto[], base: number): string =>
  p.length === 0
    ? ""
    : `${linea(p)} L${p[p.length - 1]!.x.toFixed(1)},${base} L${p[0]!.x.toFixed(1)},${base} Z`;

/* -------------------------------- Componente ------------------------------ */

export function GraficaSerie({
  titulo,
  descripcion,
  ts,
  series,
  unidad,
  resolucion,
  locale,
  etiquetaVacia,
  etiquetaPico,
}: {
  titulo: string;
  descripcion?: string;
  /** Marcas de tiempo en segundos, ordenadas. */
  ts: number[];
  series: Serie[];
  unidad: Unidad;
  resolucion: "min" | "hora";
  locale: string;
  etiquetaVacia: string;
  etiquetaPico: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activo, setActivo] = useState<number | null>(null);

  const paso = resolucion === "hora" ? 3600 : 60;

  const { escalaX, escalaY, guias, marcasX } = useMemo(() => {
    const t0 = ts[0] ?? 0;
    const t1 = ts[ts.length - 1] ?? t0 + paso;
    const rango = Math.max(1, t1 - t0);

    const todos: number[] = [];
    for (const s of series) {
      for (const v of s.valores) if (v !== null) todos.push(v);
      for (const v of s.pico ?? []) if (v !== null) todos.push(v);
    }
    const max = techo(todos.length > 0 ? Math.max(...todos) : 1, unidad);

    const escalaX = (t: number) => PAD.left + ((t - t0) / rango) * PLOT_W;
    const escalaY = (v: number) => PAD.top + PLOT_H - (Math.min(v, max) / max) * PLOT_H;

    const guias = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: max * f, y: escalaY(max * f) }));

    // Cuatro marcas de tiempo: suficientes para orientarse, pocas para no
    // convertir el eje en una fila de texto.
    const marcasX = [0, 1, 2, 3].map((i) => {
      const t = t0 + (rango * i) / 3;
      return { t, x: escalaX(t) };
    });

    return { escalaX, escalaY, max, guias, marcasX };
  }, [ts, series, unidad, paso]);

  const hora = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        ...(resolucion === "hora" ? { day: "2-digit", month: "2-digit" } : {}),
      }),
    [locale, resolucion]
  );
  const horaLarga = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale]
  );

  /**
   * El puntero apunta a una fecha, no a una línea de 2 px: se busca el índice
   * más cercano en el eje X y se muestran TODAS las series de esa fecha.
   */
  const alMover = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || ts.length === 0) return;
      const caja = svg.getBoundingClientRect();
      const rel = ((clientX - caja.left) / caja.width) * W;
      let mejor = 0;
      let dist = Infinity;
      for (let i = 0; i < ts.length; i++) {
        const d = Math.abs(escalaX(ts[i]!) - rel);
        if (d < dist) {
          dist = d;
          mejor = i;
        }
      }
      setActivo(mejor);
    },
    [ts, escalaX]
  );

  const alTeclado = useCallback(
    (e: React.KeyboardEvent) => {
      if (ts.length === 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setActivo((a) => {
          const base = a ?? ts.length - 1;
          return Math.max(0, Math.min(ts.length - 1, base + (e.key === "ArrowRight" ? 1 : -1)));
        });
      } else if (e.key === "Escape") {
        setActivo(null);
      }
    },
    [ts.length]
  );

  if (ts.length === 0) {
    return (
      <figure className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5">
        <figcaption className="mono-label text-[0.6rem]">{titulo}</figcaption>
        <p className="mt-6 mb-6 text-center text-sm text-[var(--color-fg-muted)]">
          {etiquetaVacia}
        </p>
      </figure>
    );
  }

  const saltoMax = paso * 2.5;
  const base = PAD.top + PLOT_H;
  const iUltimo = ts.length - 1;
  const tActivo = activo !== null ? ts[activo] : undefined;

  return (
    <figure className="relative rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="mono-label text-[0.6rem]">{titulo}</span>
        {descripcion && (
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">{descripcion}</span>
        )}
      </figcaption>

      {/* Leyenda: obligatoria en cuanto hay dos series, para que la identidad
          no dependa solo del color. */}
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <li key={s.clave} className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
              <svg width="14" height="4" aria-hidden="true">
                <rect width="14" height="4" rx="2" fill={s.color} />
              </svg>
              {s.nombre}
            </li>
          ))}
        </ul>
      )}

      <div className="relative mt-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          style={{ height: "auto" }}
          role="img"
          aria-label={`${titulo}. ${descripcion ?? ""}`}
          tabIndex={0}
          onPointerMove={(e) => alMover(e.clientX)}
          onPointerLeave={() => setActivo(null)}
          onKeyDown={alTeclado}
          onBlur={() => setActivo(null)}
        >
          {/* Guías: finas, sólidas y en un solo paso sobre el fondo. */}
          {guias.map((g) => (
            <g key={g.v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={g.y}
                y2={g.y}
                stroke="var(--color-line)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 8}
                y={g.y + FUENTE / 3}
                textAnchor="end"
                className="fill-[var(--color-fg-dim)] font-mono"
                style={{ fontSize: FUENTE, fontVariantNumeric: "tabular-nums" }}
              >
                {formatearEje(g.v, unidad)}
              </text>
            </g>
          ))}

          {marcasX.map((m) => (
            <text
              key={m.t}
              x={Math.min(Math.max(m.x, PAD.left + 16), W - PAD.right - 16)}
              y={H - 5}
              textAnchor="middle"
              className="fill-[var(--color-fg-dim)] font-mono"
              style={{ fontSize: FUENTE }}
            >
              {hora.format(new Date(m.t * 1000))}
            </text>
          ))}

          {series.map((s) => {
            const tramosLinea = tramos(s.valores, ts, escalaX, escalaY, saltoMax);
            const tramosPico = s.pico
              ? tramos(s.pico, ts, escalaX, escalaY, saltoMax)
              : null;
            return (
              <g key={s.clave}>
                {/* El relleno es un lavado, nunca un bloque saturado. Con datos
                    horarios el área es el pico y la línea la media. */}
                {(tramosPico ?? tramosLinea).map((p, i) => (
                  <path
                    key={`a${i}`}
                    d={area(p, base)}
                    fill={s.color}
                    opacity={tramosPico ? 0.14 : 0.1}
                  />
                ))}
                {tramosLinea.map((p, i) => (
                  <path
                    key={`l${i}`}
                    d={linea(p)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            );
          })}

          {/* Punto final con anillo del color del fondo, para que se lea aunque
              caiga encima de otra serie. */}
          {series.map((s) => {
            const v = s.valores[iUltimo];
            const t = ts[iUltimo];
            if (v === null || v === undefined || t === undefined) return null;
            return (
              <circle
                key={`fin-${s.clave}`}
                cx={escalaX(t)}
                cy={escalaY(v)}
                r="4"
                fill={s.color}
                stroke="var(--color-bg-raised)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {tActivo !== undefined && (
            <>
              <line
                x1={escalaX(tActivo)}
                x2={escalaX(tActivo)}
                y1={PAD.top}
                y2={base}
                stroke="var(--color-line-strong)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {series.map((s) => {
                const v = activo !== null ? s.valores[activo] : null;
                if (v === null || v === undefined) return null;
                return (
                  <circle
                    key={`c-${s.clave}`}
                    cx={escalaX(tActivo)}
                    cy={escalaY(v)}
                    r="4"
                    fill={s.color}
                    stroke="var(--color-bg-raised)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </>
          )}
        </svg>

        {/* El aviso va en HTML y no en el SVG: se estiliza igual que el resto
            del panel y no hay que pelearse con foreignObject. */}
        {activo !== null && tActivo !== undefined && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-0 z-10 min-w-[9rem] rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-overlay)] px-3 py-2 shadow-lg"
            style={{
              left: `${(escalaX(tActivo) / W) * 100}%`,
              transform:
                escalaX(tActivo) > W / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
            }}
          >
            <p className="font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
              {horaLarga.format(new Date(tActivo * 1000))}
            </p>
            <ul className="mt-1 grid gap-0.5">
              {series.map((s) => {
                const v = s.valores[activo];
                const p = s.pico?.[activo];
                return (
                  <li key={s.clave} className="flex items-center gap-2 text-xs whitespace-nowrap">
                    <svg width="10" height="2" aria-hidden="true" className="shrink-0">
                      <rect width="10" height="2" fill={s.color} />
                    </svg>
                    {/* El valor manda; el nombre de la serie acompaña. */}
                    <span
                      className="font-mono font-medium text-[var(--color-fg)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatear(v ?? null, unidad)}
                    </span>
                    <span className="text-[var(--color-fg-muted)]">{s.nombre}</span>
                    {p !== null && p !== undefined && (
                      <span className="text-[var(--color-fg-dim)]">
                        {etiquetaPico} {formatear(p, unidad)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <span className="sr-only">{`${titulo}: ${formatear(series[0]?.valores[iUltimo] ?? null, unidad)}`}</span>
    </figure>
  );
}
