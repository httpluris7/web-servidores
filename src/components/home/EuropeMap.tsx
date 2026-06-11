"use client";

import { motion, useReducedMotion } from "framer-motion";
import { regions } from "@/data/products";
import { viewportOnce } from "@/lib/motion";

/**
 * Mapa estilizado de Europa en SVG propio (sin librería de mapas).
 * Silueta abstracta + nodos con pulso CSS + backbone que se dibuja una vez.
 */
export function EuropeMap() {
  const reduce = useReducedMotion();

  // Punto medio del backbone: centro de masa de los nodos activos.
  const center = {
    x: regions.reduce((s, r) => s + r.map.x, 0) / regions.length,
    y: regions.reduce((s, r) => s + r.map.y, 0) / regions.length,
  };

  return (
    <div className="relative aspect-square w-full">
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Red europea de ViaHost">
        <defs>
          <radialGradient id="landGrad" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#0e1828" />
            <stop offset="100%" stopColor="#080d16" />
          </radialGradient>
        </defs>

        {/* Silueta abstracta de Europa occidental/central */}
        <path
          d="M30 64 L28 58 L24 56 L27 52 L33 53 L36 47 L34 42 L38 38 L37 33 L42 35 L45 39 L44 44 L49 41 L52 44 L58 41 L63 44 L68 40 L72 44 L66 48 L70 52 L64 55 L66 60 L60 62 L56 68 L50 66 L46 70 L40 67 L36 72 L32 70 Z"
          fill="url(#landGrad)"
          stroke="var(--color-line-strong)"
          strokeWidth="0.4"
        />

        {/* Backbone animado: enlaza los nodos en secuencia (París ↔ Fráncfort) */}
        {regions.slice(1).map((r, i) => {
          const prev = regions[i];
          if (!prev) return null;
          return (
            <motion.line
              key={`link-${r.slug}`}
              x1={prev.map.x}
              y1={prev.map.y}
              x2={r.map.x}
              y2={r.map.y}
              stroke="var(--color-accent)"
              strokeWidth="0.4"
              strokeOpacity="0.5"
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={viewportOnce}
              transition={{ duration: 1.1, delay: 0.15 * i, ease: "easeInOut" }}
            />
          );
        })}

        {/* Marcador central tenue del backbone */}
        <circle cx={center.x} cy={center.y} r="0.9" fill="var(--color-accent)" fillOpacity="0.4" />
        <circle
          cx={center.x}
          cy={center.y}
          r="0.9"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="0.4"
          strokeOpacity="0.6"
          className="node-pulse"
          style={{ transformOrigin: `${center.x}px ${center.y}px` }}
        />

        {/* Nodos con pulso CSS */}
        {regions.map((r) => (
          <g key={`node-${r.slug}`}>
            <circle cx={r.map.x} cy={r.map.y} r="1.4" fill="var(--color-accent)" />
            <circle
              cx={r.map.x}
              cy={r.map.y}
              r="1.4"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="0.6"
              className="node-pulse"
              style={{ transformOrigin: `${r.map.x}px ${r.map.y}px` }}
            />
            <text
              x={r.map.x}
              y={r.map.y - 2.6}
              fontSize="2.2"
              textAnchor="middle"
              className="fill-[var(--color-fg-muted)] font-mono"
            >
              {r.city}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
