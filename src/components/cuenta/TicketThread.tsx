"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Textarea } from "@/components/forms/Field";
import type { TicketAuthor, TicketStatus } from "@/lib/tickets";
import { fmtDate } from "@/lib/utils";

/**
 * Mensaje tal y como se le pasa al cliente: sin el `nombre` de quien responde
 * desde el panel (ahí guardamos el correo del administrador, que es asunto
 * nuestro). El hilo se etiqueta con "tú" / "soporte".
 */
export type ThreadMessage = {
  id: string;
  autor: TicketAuthor;
  cuerpo: string;
  creadoAt: string;
};

export function TicketThread({
  id,
  mensajes,
  estado,
}: {
  id: string;
  mensajes: ThreadMessage[];
  estado: TicketStatus;
}) {
  const t = useTranslations("tickets");
  const router = useRouter();

  const [respuesta, setRespuesta] = useState("");
  const [busy, setBusy] = useState<"responder" | "cerrar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar(accion: "responder" | "cerrar") {
    setError(null);
    setBusy(accion);
    try {
      const res = await fetch(`/api/cuenta/tickets/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accion, mensaje: respuesta }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(res.status === 429 ? t("detail.errorTooMany") : t("detail.errorSend"));
        return;
      }
      setRespuesta("");
      router.refresh();
    } catch {
      setError(t("detail.errorConnection"));
    } finally {
      setBusy(null);
    }
  }

  const cerrado = estado === "cerrado";

  return (
    <div className="grid gap-6">
      <ul className="grid gap-4">
        {mensajes.map((m) => {
          const mio = m.autor === "cliente";
          return (
            <li
              key={m.id}
              className={`min-w-0 rounded-[var(--radius-lg)] border p-5 ${
                mio
                  ? "border-[var(--color-line)] bg-[var(--color-bg-raised)]"
                  : "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="mono-label text-[0.6rem]">
                  {mio ? t("detail.you") : t("detail.support")}
                </p>
                <p className="font-mono text-[0.7rem] text-[var(--color-fg-dim)]">
                  {fmtDate(m.creadoAt, true)}
                </p>
              </div>
              {/* whitespace-pre-wrap: el mensaje se escribió en un textarea y sus
                  saltos de línea son parte de lo que quiso decir. */}
              <p className="mt-3 text-sm whitespace-pre-wrap break-words text-[var(--color-fg)]">
                {m.cuerpo}
              </p>
            </li>
          );
        })}
      </ul>

      {cerrado && (
        <p className="text-sm text-[var(--color-fg-muted)]">{t("detail.closedNotice")}</p>
      )}

      <section className="border-t border-[var(--color-line)] pt-6">
        <label htmlFor="respuesta" className="mono-label text-[0.6rem]">
          {t("detail.replyLabel")}
        </label>
        <Textarea
          id="respuesta"
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          placeholder={t("detail.replyPlaceholder")}
          maxLength={5000}
          className="mt-2"
        />

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={busy !== null || respuesta.trim().length < 2}
            onClick={() => enviar("responder")}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-40"
          >
            {busy === "responder" ? t("detail.replying") : t("detail.reply")}
          </button>

          {!cerrado && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => enviar("cerrar")}
              className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] disabled:opacity-40"
            >
              {t("detail.close")}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
