"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Metric = {
  label: string;
  base: number;
  jitter: number;
  decimals: number;
  suffix: string;
};

const metrics: Metric[] = [
  { label: "Network traffic", base: 8.4, jitter: 0.6, decimals: 2, suffix: " Tbps" },
  { label: "Packets mitigated", base: 1.42, jitter: 0.05, decimals: 2, suffix: "M/s" },
  { label: "Servers online", base: 14820, jitter: 12, decimals: 0, suffix: "" },
  { label: "Uptime 90 d", base: 99.997, jitter: 0.002, decimals: 3, suffix: " %" },
];

/**
 * Barra de métricas en vivo con un "tick" sutil. Los valores son simulados en
 * cliente (placeholder visual). TODO: conectar a métricas reales si existe API.
 */
export function LiveMetrics() {
  const reduce = useReducedMotion();
  const [values, setValues] = useState(metrics.map((m) => m.base));
  // Semilla determinista para evitar mismatch SSR/CSR; se anima sólo en cliente.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (reduce) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setValues(
        metrics.map((m, idx) => {
          // Oscilación pseudo-aleatoria pero estable basada en seno.
          const wave = Math.sin(i * 0.6 + idx * 1.7);
          return m.base + wave * m.jitter;
        })
      );
    }, 2200);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-4">
      {metrics.map((m, i) => (
        <div key={m.label} className="bg-[var(--color-bg-base)] px-5 py-4">
          <dt className="mono-label text-[0.65rem]">{m.label}</dt>
          <dd className="mt-1.5 flex items-baseline gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
            <span
              className="font-mono text-lg tabular-nums text-[var(--color-fg)] transition-opacity duration-500"
              style={{ opacity: mounted ? 1 : 0.85 }}
            >
              {(values[i] ?? m.base).toLocaleString("en-US", {
                minimumFractionDigits: m.decimals,
                maximumFractionDigits: m.decimals,
              })}
              {m.suffix}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
