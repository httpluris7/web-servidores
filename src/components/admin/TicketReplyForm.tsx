"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Textarea } from "@/components/forms/Field";
import type { TicketStatus } from "@/lib/tickets";

/**
 * Respuesta a un ticket desde el panel.
 *
 * Se puede contestar también desde el buzón de soporte —el correo que llega
 * lleva al cliente en el `Reply-To`— y esa respuesta se recoge después de la
 * carpeta de enviados; las dos vías acaban en el hilo. Esta evita el rodeo y
 * además avisa al cliente al momento.
 */
export function TicketReplyForm({ id, estado }: { id: string; estado: TicketStatus }) {
  const t = useTranslations("admin");
  const router = useRouter();

  const [mensaje, setMensaje] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(payload: Record<string, unknown>, cual: string) {
    setError(null);
    setAviso(null);
    setBusy(cual);
    try {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(t("tickets.detail.errorSend"));
        return;
      }
      // El correo al cliente es best-effort: si falla hay que saberlo, porque la
      // respuesta queda en el hilo pero él no se entera hasta que entre.
      if (json.avisado === false) setAviso(t("tickets.detail.mailFailed"));
      setMensaje("");
      router.refresh();
    } catch {
      setError(t("tickets.detail.errorConnection"));
    } finally {
      setBusy(null);
    }
  }

  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

  return (
    <section className="border-t border-[var(--color-line)] pt-6">
      <label htmlFor="respuesta" className="mono-label text-[0.6rem]">
        {t("tickets.detail.replyLabel")}
      </label>
      <p className="mt-1 mb-2 text-xs text-[var(--color-fg-muted)]">
        {t("tickets.detail.replyHint")}
      </p>
      <Textarea
        id="respuesta"
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        placeholder={t("tickets.detail.replyPlaceholder")}
        maxLength={5000}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy !== null || mensaje.trim().length < 2}
          onClick={() => enviar({ accion: "responder", mensaje }, "responder")}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-40"
        >
          {busy === "responder" ? t("tickets.detail.sending") : t("tickets.detail.send")}
        </button>

        {estado !== "cerrado" ? (
          <button
            type="button"
            disabled={busy !== null}
            className={boton}
            onClick={() => enviar({ accion: "estado", estado: "cerrado" }, "cerrar")}
          >
            {t("tickets.detail.close")}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            className={boton}
            onClick={() => enviar({ accion: "estado", estado: "abierto" }, "reabrir")}
          >
            {t("tickets.detail.reopen")}
          </button>
        )}
      </div>

      {aviso && <p className="mt-4 text-sm text-amber-300">{aviso}</p>}
      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </section>
  );
}
