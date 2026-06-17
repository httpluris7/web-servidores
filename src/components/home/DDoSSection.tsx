"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { site } from "@/data/site";
import { ddosFeatures } from "@/data/content";

const ATTACK = Array.from({ length: 7 });
const CLEAN = Array.from({ length: 4 });

export function DDoSSection() {
  const t = useTranslations("home");
  const ref = useRef<HTMLDivElement>(null);
  // Sin `once`: la animación sólo corre mientras la sección es visible.
  const inView = useInView(ref, { margin: "-10%" });
  const reduce = useReducedMotion();
  const animate = inView && !reduce;

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-y border-[var(--color-line)] bg-[#04060a]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 50%, rgba(255,77,77,0.08), transparent 70%), radial-gradient(50% 50% at 85% 50%, var(--color-accent-glow), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="container-edge relative py-16 md:py-32">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-[var(--color-accent)]">/09</span>
          <span className="mono-label">{t("ddos.kicker")}</span>
        </div>
        <h2 className="mt-6 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          {t.rich("ddos.title", {
            accent: (chunks) => <span className="text-accent">{chunks}</span>,
          })}
        </h2>

        {/* Diagrama de flujo */}
        <div className="mt-14 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[#070b12]">
          <svg viewBox="0 0 100 40" className="h-auto w-full" role="img" aria-label={t("ddos.diagramLabel")}>
            {/* Origen del ataque */}
            <text x="6" y="6" fontSize="2.4" className="fill-[#ff6b6b] font-mono">{t("ddos.attackTraffic")}</text>
            {/* Escudo */}
            <text x="44" y="6" fontSize="2.4" className="fill-[var(--color-fg-muted)] font-mono">{t("ddos.shield")}</text>
            {/* Servidor */}
            <text x="80" y="6" fontSize="2.4" className="fill-[var(--color-accent)] font-mono">{t("ddos.yourServer")}</text>

            {/* Línea base */}
            <line x1="4" y1="20" x2="96" y2="20" stroke="var(--color-line)" strokeWidth="0.2" />

            {/* Escudo (barra vertical) */}
            <rect x="49.2" y="9" width="1.6" height="22" rx="0.8" fill="var(--color-accent)" opacity="0.85" />
            <rect x="47.6" y="9" width="4.8" height="22" rx="1" fill="none" stroke="var(--color-accent)" strokeWidth="0.25" opacity="0.5" />

            {/* Servidor (icono) */}
            <rect x="86" y="14" width="9" height="12" rx="1" fill="none" stroke="var(--color-accent)" strokeWidth="0.4" />
            <circle cx="90.5" cy="17.5" r="0.7" fill="var(--color-accent)" />
            <line x1="88" y1="22" x2="93" y2="22" stroke="var(--color-accent)" strokeWidth="0.3" />

            {/* Partículas de ataque: entran rojas y se desvanecen/desvían en el escudo */}
            {ATTACK.map((_, i) => {
              const y = 12 + (i % 5) * 4;
              const deflect = i % 3 === 0 ? -6 : 6;
              return (
                <motion.circle
                  key={`atk-${i}`}
                  r="0.8"
                  fill="#ff5b5b"
                  cx={6}
                  cy={y}
                  initial={{ cx: 6, cy: y, opacity: 0 }}
                  animate={
                    animate
                      ? { cx: [6, 47, 49], cy: [y, y, y + deflect], opacity: [0, 1, 0] }
                      : { cx: 6, cy: y, opacity: reduce ? 0.6 : 0 }
                  }
                  transition={{
                    duration: 2,
                    delay: i * 0.28,
                    repeat: animate ? Infinity : 0,
                    repeatDelay: 0.6,
                    ease: "easeIn",
                    times: [0, 0.7, 1],
                  }}
                />
              );
            })}

            {/* Tráfico limpio: sale del escudo hacia el servidor, en color acento */}
            {CLEAN.map((_, i) => {
              const y = 16 + i * 2.6;
              return (
                <motion.circle
                  key={`cln-${i}`}
                  r="0.8"
                  fill="var(--color-accent)"
                  cx={51}
                  cy={y}
                  initial={{ cx: 51, opacity: 0 }}
                  animate={animate ? { cx: [51, 86], opacity: [0, 1, 1, 0] } : { cx: 86, opacity: reduce ? 0.8 : 0 }}
                  transition={{
                    duration: 1.6,
                    delay: 0.5 + i * 0.3,
                    repeat: animate ? Infinity : 0,
                    repeatDelay: 1,
                    ease: "easeOut",
                  }}
                />
              );
            })}
          </svg>
        </div>

        <p className="mt-6 font-mono text-sm text-[var(--color-fg-muted)]">
          {t("ddos.footnote")}
        </p>

        {/* Métricas */}
        <dl className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3">
          {[
            { v: `${site.ddos.mitigationTbps} Tbps`, l: t("ddos.stats.mitigation") },
            { v: site.ddos.absorbedAttacks, l: t("ddos.stats.absorbed") },
            { v: `${site.ddos.filteredToServer}`, l: t("ddos.stats.filtered") },
          ].map((s) => (
            <div key={s.l} className="bg-[#070b12] px-6 py-5">
              <dt className="font-mono text-3xl font-semibold text-[var(--color-accent)]">{s.v}</dt>
              <dd className="mono-label mt-2">{s.l}</dd>
            </div>
          ))}
        </dl>

        {/* Features de seguridad */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ddosFeatures.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-fg-muted)]"
            >
              <span className="text-[var(--color-accent)]">✓</span>
              {t(`ddos.features.${i}`)}
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            href="/proteccion-ddos"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
          >
            {t("ddos.cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
