"use client";

import { useState } from "react";
import { site } from "@/data/site";
import { Label, Input, Textarea, Select, FieldError } from "./Field";

type Topic = "ventas" | "soporte" | "abuse" | "otro";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const [topic, setTopic] = useState<Topic>("ventas");
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  function validate(): boolean {
    const e: Errors = {};
    if (values.name.trim().length < 2) e.name = "Indica tu nombre.";
    if (!emailRe.test(values.email)) e.email = "Introduce un email válido.";
    if (values.message.trim().length < 10) e.message = "Cuéntanos un poco más (mín. 10 caracteres).";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setStatus("sending");

    // TODO (API): enviar a tu backend / servicio de email. Ejemplo:
    //   await fetch("/api/contacto", { method: "POST", body: JSON.stringify({ ...values, topic }) });
    // El destino sugerido según el asunto:
    //   ventas → site.contact.sales · soporte → site.contact.support · abuse → site.contact.abuse
    await new Promise((r) => setTimeout(r, 700));
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <div className="font-mono text-sm text-[var(--color-accent)]">● mensaje recibido</div>
        <h3 className="mt-3 text-xl font-semibold">Gracias, {values.name.split(" ")[0]}.</h3>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Hemos registrado tu mensaje. Te responderemos a{" "}
          <span className="text-[var(--color-fg)]">{values.email}</span> lo antes posible.
        </p>
        <button
          type="button"
          onClick={() => {
            setValues({ name: "", email: "", message: "" });
            setStatus("idle");
          }}
          className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-sm transition-colors hover:border-[var(--color-accent)]"
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="topic">Asunto</Label>
        <Select id="topic" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
          <option value="ventas">Ventas y presupuestos</option>
          <option value="soporte">Soporte técnico</option>
          <option value="abuse">Reporte de abuso</option>
          <option value="otro">Otro</option>
        </Select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="name" required>
            Nombre
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Tu nombre"
            aria-invalid={!!errors.name}
          />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            placeholder="tu@email.com"
            aria-invalid={!!errors.email}
          />
          <FieldError>{errors.email}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="message" required>
          Mensaje
        </Label>
        <Textarea
          id="message"
          value={values.message}
          onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
          placeholder="¿En qué podemos ayudarte?"
          aria-invalid={!!errors.message}
        />
        <FieldError>{errors.message}</FieldError>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
        >
          {status === "sending" ? "Enviando…" : "Enviar mensaje →"}
        </button>
        <p className="font-mono text-xs text-[var(--color-fg-dim)]">
          o escribe a{" "}
          <a href={`mailto:${site.contact.sales}`} className="text-[var(--color-accent)]">
            {site.contact.sales}
          </a>
        </p>
      </div>
    </form>
  );
}
