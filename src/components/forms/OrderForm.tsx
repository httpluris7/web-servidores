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
  { key: "storage", label: "Disco" },
  { key: "bandwidth", label: "Red" },
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

  function validate(): boolean {
    const e: Errors = {};
    if (values.name.trim().length < 2) e.name = "Indica tu nombre o empresa.";
    if (!emailRe.test(values.email)) e.email = "Introduce un email válido.";
    if (!terms) e.terms = "Debes aceptar los términos para continuar.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    // TODO (API): registrar el pedido en tu backend antes del handoff al pago.
    //   await fetch("/api/pedidos", { method: "POST", body: JSON.stringify({ planId: plan.id, ...values }) });
    await new Promise((r) => setTimeout(r, 700));
    setStatus("done");
  }

  const regionName = regions?.find((r) => r.slug === values.region)?.name;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Formulario */}
      <div>
        {status === "done" ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
            <div className="font-mono text-sm text-[var(--color-accent)]">● pedido registrado</div>
            <h2 className="mt-3 text-2xl font-semibold">Todo listo, {values.name.split(" ")[0]}.</h2>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              Hemos registrado tu solicitud de <strong className="text-[var(--color-fg)]">{plan.name}</strong>
              {regionName ? ` en ${regionName}` : ""}. El último paso es el pago seguro en el panel.
            </p>
            <a
              href={billingHandoffUrl(plan.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
            >
              Ir al pago seguro →
            </a>
            <p className="mt-4 font-mono text-xs text-[var(--color-fg-dim)]">
              {/* TODO (API): este botón lleva al panel de facturación externo (site.billingUrl). */}
              provisioning en 60 s tras confirmar el pago
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="name" required>
                  Nombre o empresa
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

            {regions && regions.length > 0 && (
              <div>
                <Label htmlFor="region">Región de despliegue</Label>
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
                  Acepto los{" "}
                  <a href="/legal/terminos" className="text-[var(--color-accent)] underline">
                    términos
                  </a>{" "}
                  y la{" "}
                  <a href="/legal/privacidad" className="text-[var(--color-accent)] underline">
                    política de privacidad
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
              {status === "sending" ? "Procesando…" : "Confirmar y desplegar →"}
            </button>
            <p className="font-mono text-xs text-[var(--color-fg-dim)]">
              sin permanencia · cancela cuando quieras · soporte 24/7
            </p>
          </form>
        )}
      </div>

      {/* Resumen del pedido */}
      <aside className="h-fit rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 lg:sticky lg:top-24">
        <span className="mono-label text-[0.65rem]">Resumen · {lineTitle}</span>
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
              <dt className="mono-label text-[0.6rem]">Región</dt>
              <dd className="text-right text-[var(--color-accent)]">{regionName}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex items-baseline justify-between border-t border-[var(--color-line)] pt-5">
          <span className="text-sm text-[var(--color-fg-muted)]">Total mensual</span>
          <span className="font-mono text-2xl font-semibold">{eur(plan.price)}</span>
        </div>
        <p className="mt-2 text-right font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
          IVA no incluido · {site.brand}
        </p>
      </aside>
    </div>
  );
}
