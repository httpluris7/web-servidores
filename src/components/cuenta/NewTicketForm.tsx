"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Label, Input, Textarea, Select, FieldError } from "@/components/forms/Field";

type Category = "tecnico" | "facturacion" | "otro";
type Errors = Partial<Record<"asunto" | "mensaje", string>>;

/** Servidores del cliente, para poder decir a cuál se refiere el ticket. */
export type TicketServerOption = { id: string; label: string };

export function NewTicketForm({ servers }: { servers: TicketServerOption[] }) {
  const t = useTranslations("tickets");
  const router = useRouter();

  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [categoria, setCategoria] = useState<Category>("tecnico");
  const [servidorId, setServidorId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function validate(): boolean {
    const e: Errors = {};
    if (asunto.trim().length < 3) e.asunto = t("form.errorSubject");
    if (mensaje.trim().length < 10) e.mensaje = t("form.errorMessage");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setEnviando(true);

    try {
      const res = await fetch("/api/cuenta/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asunto, mensaje, categoria, servidorId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        if (json?.errors) setErrors(json.errors as Errors);
        setFormError(res.status === 429 ? t("form.errorTooMany") : t("form.errorSend"));
        setEnviando(false);
        return;
      }
      // El hilo recién creado es el mejor sitio al que llevarle: ahí ve el
      // mensaje tal y como nos ha llegado y puede seguir escribiendo.
      router.push(`/cuenta/soporte/${json.id}`);
      router.refresh();
    } catch {
      setFormError(t("form.errorConnection"));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="categoria">{t("form.category")}</Label>
          <Select
            id="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Category)}
          >
            <option value="tecnico">{t("category.tecnico")}</option>
            <option value="facturacion">{t("category.facturacion")}</option>
            <option value="otro">{t("category.otro")}</option>
          </Select>
        </div>

        {servers.length > 0 && (
          <div>
            <Label htmlFor="servidor">{t("form.server")}</Label>
            <Select
              id="servidor"
              value={servidorId}
              onChange={(e) => setServidorId(e.target.value)}
            >
              <option value="">{t("form.serverNone")}</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="asunto" required>
          {t("form.subject")}
        </Label>
        <Input
          id="asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          placeholder={t("form.subjectPlaceholder")}
          maxLength={120}
          aria-invalid={!!errors.asunto}
        />
        <FieldError>{errors.asunto}</FieldError>
      </div>

      <div>
        <Label htmlFor="mensaje" required>
          {t("form.message")}
        </Label>
        <Textarea
          id="mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder={t("form.messagePlaceholder")}
          maxLength={5000}
          aria-invalid={!!errors.mensaje}
        />
        <FieldError>{errors.mensaje}</FieldError>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
        >
          {enviando ? t("form.sending") : t("form.send")}
        </button>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {formError}
        </p>
      )}
    </form>
  );
}
