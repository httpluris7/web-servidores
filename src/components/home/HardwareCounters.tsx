"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const items = [
  {
    to: 5.7,
    decimals: 1,
    suffix: " GHz",
    label: "CPU boost",
    copy: "Latest-generation AMD EPYC and Ryzen. Single-thread performance that never falls short.",
  },
  {
    to: 14,
    decimals: 0,
    suffix: " GB/s",
    label: "NVMe Gen4",
    copy: "Storage that feeds the CPU with no bottlenecks. Zero slow disks.",
  },
  {
    to: 10,
    decimals: 0,
    suffix: " Gbps",
    label: "Network per server",
    copy: "Dedicated, symmetric uplink. Bandwidth isn't an add-on, it's the baseline.",
  },
];

export function HardwareCounters() {
  const root = useRef<HTMLDivElement>(null);
  const pinned = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [values, setValues] = useState(items.map(() => 0));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduce) {
      setValues(items.map((i) => i.to));
      setProgress(1);
      return;
    }

    let ctx: { revert: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const gsapMod = await import("gsap");
      const stMod = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      const gsap = gsapMod.default;
      const ScrollTrigger = stMod.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        const state = { p: 0 };
        gsap.to(state, {
          p: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "+=1400",
            scrub: 0.6,
            // Pineamos un wrapper interno, NO el <section> raíz del componente.
            // Si GSAP envuelve la raíz en su pin-spacer, al desmontar la página
            // React intenta removeChild sobre un nodo que ya no es hijo directo
            // de su padre y la app entera peta (NotFoundError: removeChild).
            pin: pinned.current,
            anticipatePin: 1,
          },
          onUpdate: () => {
            setProgress(state.p);
            setValues(items.map((it) => it.to * Math.min(state.p * 1.15, 1)));
          },
        });
      }, root);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [reduce]);

  return (
    <section
      ref={root}
      className="relative border-y border-[var(--color-line)]"
    >
      <div ref={pinned} className="relative flex min-h-screen items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" aria-hidden="true" />
      <div className="container-edge relative w-full py-14 md:py-20">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-[var(--color-accent)]">/04</span>
          <span className="mono-label">No-compromise hardware</span>
        </div>
        <h2 className="mt-6 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          Every figure, measured. None, inflated.
        </h2>

        <div className="mt-14 grid gap-px bg-[var(--color-line)] md:grid-cols-3">
          {items.map((it, i) => (
            <div key={it.label} className="bg-[var(--color-bg-base)] p-6 md:p-8">
              <div className="flex items-baseline font-mono text-5xl font-semibold tracking-tight md:text-6xl">
                <span className="tabular-nums">
                  {(values[i] ?? 0).toLocaleString("en-US", {
                    minimumFractionDigits: it.decimals,
                    maximumFractionDigits: it.decimals,
                  })}
                </span>
                <span className="text-[var(--color-accent)]">{it.suffix}</span>
              </div>
              <p className="mono-label mt-3">{it.label}</p>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{it.copy}</p>
            </div>
          ))}
        </div>

        {/* Barra de progreso del scroll pinned */}
        <div className="mt-10 h-px w-full bg-[var(--color-line)]">
          <div
            className="h-px bg-[var(--color-accent)] transition-[width] duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
      </div>
    </section>
  );
}
