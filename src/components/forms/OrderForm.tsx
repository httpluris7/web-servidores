"use client";

import { useState } from "react";
import type { Plan, Region } from "@/data/products";
import { billingHandoffUrl, site } from "@/data/site";
import { eur } from "@/lib/utils";
import { Label, Input, Select, FieldError } from "./Field";

type Errors = Partial<Record<"name" | "email" | "terms", string>>;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const specRows: { key: keyof Plan; label: string }[] = [
  { key: "cpu", label: "CPU" },
  { key: "ram", label: "RAM" },
  { key: "storage", label: "Storage" },
  { key: "bandwidth", label: "Network" },
];

export function OrderForm({
  plan,
  lineTitle,
  regions,
}: {
  plan: Plan;
  lineTitle: string;
  regions?: Region[];
}) {
  const [values, setValues] = useState({ name: "", email: "", region: regions?.[0]?.slug ?? "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Errors = {};
    if (values.name.trim().length < 2) e.name = "Enter your name or company.";
    if (!emailRe.test(values.email)) e.email = "Enter a valid email.";
    if (!terms) e.terms = "You must accept the terms to continue.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: plan.id, ...values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.errors) setErrors(data.errors as Errors);
        setFormError(data?.error ?? "Could not register the order. Try again.");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setFormError("Connection error. Check your network and try again.");
      setStatus("idle");
    }
  }

  const regionName = regions?.find((r) => r.slug === values.region)?.name;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Formulario */}
      <div>
        {status === "done" ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
            <div className="font-mono text-sm text-[var(--color-accent)]">● order registered</div>
            <h2 className="mt-3 text-2xl font-semibold">All set, {values.name.split(" ")[0]}.</h2>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              We have registered your request for <strong className="text-[var(--color-fg)]">{plan.name}</strong>
              {regionName ? ` in ${regionName}` : ""}. The last step is secure payment in the panel.
            </p>
            <a
              href={billingHandoffUrl(plan.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
            >
              Go to secure payment →
            </a>
            <p className="mt-4 font-mono text-xs text-[var(--color-fg-dim)]">
              {/* TODO (API): este botón lleva al panel de facturación externo (site.billingUrl). */}
              provisioning in 60 s after payment is confirmed
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="name" required>
                  Name or company
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

            {regions && regions.length > 0 && (
              <div>
                <Label htmlFor="region">Deployment region</Label>
                <Select
                  id="region"
                  value={values.region}
                  onChange={(e) => setValues((v) => ({ ...v, region: e.target.value }))}
                >
                  {regions.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name} — {r.city}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-fg-muted)]">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                  aria-invalid={!!errors.terms}
                />
                <span>
                  I accept the{" "}
                  <a href="/legal/terminos" className="text-[var(--color-accent)] underline">
                    terms
                  </a>{" "}
                  and the{" "}
                  <a href="/legal/privacidad" className="text-[var(--color-accent)] underline">
                    privacy policy
                  </a>
                  .
                </span>
              </label>
              <FieldError>{errors.terms}</FieldError>
            </div>

            <button
              type="submit"
              disabled={status === "sending"}
              className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
            >
              {status === "sending" ? "Processing…" : "Confirm and deploy →"}
            </button>
            <p className="font-mono text-xs text-[var(--color-fg-dim)]">
              no commitment · cancel anytime · 24/7 support
            </p>
            {formError && (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {formError}
              </p>
            )}
          </form>
        )}
      </div>

      {/* Resumen del pedido */}
      <aside className="h-fit rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 lg:sticky lg:top-24">
        <span className="mono-label text-[0.65rem]">Summary · {lineTitle}</span>
        <h3 className="mt-2 text-xl font-semibold">{plan.name}</h3>
        {plan.popular && (
          <span className="mt-2 inline-block rounded bg-[var(--color-accent)] px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-wider text-black">
            Popular
          </span>
        )}

        <dl className="mt-5 space-y-2.5 border-t border-[var(--color-line)] pt-5 text-sm">
          {specRows.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-4">
              <dt className="mono-label text-[0.6rem]">{row.label}</dt>
              <dd className="text-right text-[var(--color-fg)]">{plan[row.key] as string}</dd>
            </div>
          ))}
          {regionName && (
            <div className="flex items-start justify-between gap-4">
              <dt className="mono-label text-[0.6rem]">Region</dt>
              <dd className="text-right text-[var(--color-accent)]">{regionName}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex items-baseline justify-between border-t border-[var(--color-line)] pt-5">
          <span className="text-sm text-[var(--color-fg-muted)]">Monthly total</span>
          <span className="font-mono text-2xl font-semibold">{eur(plan.price)}</span>
        </div>
        <p className="mt-2 text-right font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
          VAT not included · {site.brand}
        </p>
      </aside>
    </div>
  );
}
