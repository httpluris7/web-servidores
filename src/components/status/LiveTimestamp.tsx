"use client";

import { useEffect, useState } from "react";

/** Marca de tiempo "actualizado" hidratada en cliente (evita mismatch SSR). */
export function LiveTimestamp() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const fmt = () =>
      new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Europe/Madrid",
      }).format(new Date());
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs text-[var(--color-fg-dim)]" suppressHydrationWarning>
      Actualizado: {now ?? "—"} CET
    </span>
  );
}
