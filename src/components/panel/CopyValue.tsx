"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "./icons";

/**
 * Valor sensible (p. ej. la contraseña) enmascarado, con botón para revelarlo y
 * botón para copiarlo. La contraseña llega ya en el HTML solo en esta maqueta;
 * en producción se pedirá bajo demanda.
 */
export function CopyValue({ value, secret = false }: { value: string; secret?: boolean }) {
  const t = useTranslations("panel");
  const [revealed, setRevealed] = useState(!secret);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin portapapeles: no pasa nada, el valor sigue visible al revelar */
    }
  }

  const iconBtn =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm break-all text-[var(--color-fg)]">
        {revealed ? value : "•".repeat(Math.min(12, value.length))}
      </span>
      {secret && (
        <button
          type="button"
          className={iconBtn}
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? t("info.hide") : t("info.reveal")}
          title={revealed ? t("info.hide") : t("info.reveal")}
        >
          <Icon name={revealed ? "eyeOff" : "eye"} size={15} />
        </button>
      )}
      <button
        type="button"
        className={iconBtn}
        onClick={copy}
        aria-label={copied ? t("info.copied") : t("info.copy")}
        title={copied ? t("info.copied") : t("info.copy")}
      >
        <Icon name={copied ? "check" : "copy"} size={15} className={copied ? "text-[var(--color-accent)]" : ""} />
      </button>
    </span>
  );
}
