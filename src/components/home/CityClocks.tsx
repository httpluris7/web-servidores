"use client";

import { useEffect, useState } from "react";
import { clockCities } from "@/data/content";
import { Marquee } from "@/components/ui/Marquee";

function timeFor(tz: string, now: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

/**
 * Relojes de ciudades europeas en tiempo real. Hidratado en cliente (no se
 * renderiza la hora en SSR) para evitar mismatch de hidratación.
 */
export function CityClocks() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Marquee duration={40} className="border-y border-[var(--color-line)] py-4">
      {clockCities.map((c) => (
        <span key={c.city} className="mx-8 flex items-center gap-2 whitespace-nowrap font-mono text-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          <span className="text-[var(--color-fg-muted)]">{c.city}</span>
          <span className="tabular-nums text-[var(--color-fg)]" suppressHydrationWarning>
            {now ? timeFor(c.tz, now) : "--:--:--"}
          </span>
        </span>
      ))}
    </Marquee>
  );
}
