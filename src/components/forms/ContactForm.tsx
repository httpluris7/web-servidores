"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { site } from "@/data/site";
import { Label, Input, Textarea, Select, FieldError } from "./Field";

type Topic = "ventas" | "soporte" | "abuse" | "otro";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const t = useTranslations("pages");
  const [topic, setTopic] = useState<Topic>("ventas");
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Errors = {};
    if (values.name.trim().length < 2) e.name = t("contactForm.errorName");
    if (!emailRe.test(values.email)) e.email = t("contactForm.errorEmail");
    if (values.message.trim().length < 10) e.message = t("contactForm.errorMessage");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, topic }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.errors) setErrors(data.errors as Errors);
        setFormError(data?.error ?? t("contactForm.errorSend"));
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setFormError(t("contactForm.errorConnection"));
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <div className="font-mono text-sm text-[var(--color-accent)]">{t("contactForm.sentBadge")}</div>
        <h3 className="mt-3 text-xl font-semibold">{t("contactForm.sentThanks", { name: values.name.split(" ")[0] ?? values.name })}</h3>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          {t("contactForm.sentBodyPrefix")}
          <span className="text-[var(--color-fg)]">{values.email}</span>
          {t("contactForm.sentBodySuffix")}
        </p>
        <button
          type="button"
          onClick={() => {
            setValues({ name: "", email: "", message: "" });
            setStatus("idle");
          }}
          className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-sm transition-colors hover:border-[var(--color-accent)]"
        >
          {t("contactForm.sendAnother")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="topic">{t("contactForm.subject")}</Label>
        <Select id="topic" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
          <option value="ventas">{t("contactForm.topicSales")}</option>
          <option value="soporte">{t("contactForm.topicSupport")}</option>
          <option value="abuse">{t("contactForm.topicAbuse")}</option>
          <option value="otro">{t("contactForm.topicOther")}</option>
        </Select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="name" required>
            {t("contactForm.name")}
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder={t("contactForm.namePlaceholder")}
            aria-invalid={!!errors.name}
          />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="email" required>
            {t("contactForm.email")}
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
          {t("contactForm.message")}
        </Label>
        <Textarea
          id="message"
          value={values.message}
          onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
          placeholder={t("contactForm.messagePlaceholder")}
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
          {status === "sending" ? t("contactForm.sending") : t("contactForm.send")}
        </button>
        <p className="font-mono text-xs text-[var(--color-fg-dim)]">
          {t("contactForm.orEmail")}
          <a href={`mailto:${site.contact.sales}`} className="text-[var(--color-accent)]">
            {site.contact.sales}
          </a>
        </p>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {formError}
        </p>
      )}
    </form>
  );
}
