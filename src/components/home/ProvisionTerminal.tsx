"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { terminalLines } from "@/data/content";
import { SectionHeader } from "@/components/ui/SectionHeader";

/**
 * Terminal de provisioning con typing secuencial. Se dispara una vez al entrar
 * en viewport. Con reduced-motion muestra todo el log de inmediato.
 */
export function ProvisionTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setVisible(terminalLines.length);
      setDone(true);
      return;
    }
    let line = 0;
    const id = setInterval(() => {
      line += 1;
      setVisible(line);
      if (line >= terminalLines.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 700);
    return () => clearInterval(id);
  }, [inView, reduce]);

  return (
    <section className="container-edge py-24 md:py-32">
      <SectionHeader
        index="/03"
        kicker="Provisioning automatizado"
        title="Esto pasa al pulsar “Desplegar”."
        description="Sin tickets, sin colas, sin intervención humana. El sistema asigna, instala y conecta tu servidor mientras lees esta frase."
      />

      <div ref={ref} className="mt-12 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[#070b12]">
        {/* Barra de la terminal */}
        <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-[var(--color-fg-dim)]">
            nodara@deploy — provision
          </span>
        </div>

        {/* Log */}
        <div className="space-y-1.5 p-5 font-mono text-sm leading-relaxed md:p-7 md:text-base">
          {terminalLines.map((l, i) => {
            const shown = i < visible;
            const isLast = i === terminalLines.length - 1;
            return (
              <div
                key={l.cmd}
                className="flex items-center gap-2 transition-opacity duration-300"
                style={{ opacity: shown ? 1 : 0 }}
              >
                <span className="text-[var(--color-accent)]">$</span>
                <span className="text-[var(--color-fg-muted)]">{l.cmd}</span>
                <span className="flex-1 border-b border-dotted border-[var(--color-line)]" />
                <span className={isLast ? "font-semibold text-[var(--color-accent)]" : "text-[var(--color-accent)]"}>
                  {l.ok}
                </span>
              </div>
            );
          })}
          {!done && (
            <span className="inline-block h-4 w-2.5 translate-y-0.5 cursor-blink bg-[var(--color-accent)]" />
          )}
        </div>
      </div>

      <p className="mt-6 max-w-xl font-mono text-sm text-[var(--color-fg-muted)]">
        ↳ Esto es lo que pasa{" "}
        <span className="text-[var(--color-accent)]">54 segundos</span> después de pagar.
      </p>
    </section>
  );
}
