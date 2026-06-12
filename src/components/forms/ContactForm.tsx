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
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Errors = {};
    if (values.name.trim().length < 2) e.name = "Enter your name.";
    if (!emailRe.test(values.email)) e.email = "Enter a valid email.";
    if (values.message.trim().length < 10) e.message = "Tell us a bit more (min. 10 characters).";
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
        setFormError(data?.error ?? "Could not send the message. Try again.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setFormError("Connection error. Check your network and try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <div className="font-mono text-sm text-[var(--color-accent)]">● message received</div>
        <h3 className="mt-3 text-xl font-semibold">Thanks, {values.name.split(" ")[0]}.</h3>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          We have logged your message. We will reply to{" "}
          <span className="text-[var(--color-fg)]">{values.email}</span> as soon as possible.
        </p>
        <button
          type="button"
          onClick={() => {
            setValues({ name: "", email: "", message: "" });
            setStatus("idle");
          }}
          className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-sm transition-colors hover:border-[var(--color-accent)]"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="topic">Subject</Label>
        <Select id="topic" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
          <option value="ventas">Sales and quotes</option>
          <option value="soporte">Technical support</option>
          <option value="abuse">Abuse report</option>
          <option value="otro">Other</option>
        </Select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="name" required>
            Name
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Your name"
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
          Message
        </Label>
        <Textarea
          id="message"
          value={values.message}
          onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
          placeholder="How can we help you?"
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
          {status === "sending" ? "Sending…" : "Send message →"}
        </button>
        <p className="font-mono text-xs text-[var(--color-fg-dim)]">
          or email{" "}
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
