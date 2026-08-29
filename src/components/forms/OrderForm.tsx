"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Plan, Region } from "@/data/products";
import { site } from "@/data/site";
import { ofertablesParaDisco, discoGbDeTexto, OS_DEFAULT } from "@/lib/provisioner/os";
import { defaultVpsRegionSlug } from "@/lib/regions";
import { eur } from "@/lib/utils";
import { Price } from "@/components/ui/Price";
import { BankTransfer } from "@/components/ui/BankTransfer";
import { Label, Input, Select, FieldError } from "./Field";

type Errors = Partial<Record<"name" | "email" | "terms", string>>;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const specRows: { key: keyof Plan; tKey: string }[] = [
  { key: "cpu", tKey: "specCpu" },
  { key: "ram", tKey: "specRam" },
  { key: "storage", tKey: "specStorage" },
  { key: "bandwidth", tKey: "specNetwork" },
];

export function OrderForm({
  plan,
  lineTitle,
  regions,
  stripeEnabled = false,
}: {
  plan: Plan;
  lineTitle: string;
  regions?: Region[];
  /** ¿Hay pasarela configurada? Sin ella solo se ofrece la transferencia. */
  stripeEnabled?: boolean;
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [values, setValues] = useState({
    name: "",
    email: "",
    // Región provisionable por defecto (nunca una sin Proxmox: ver `regions.ts`).
    region: regions ? defaultVpsRegionSlug(regions) : "",
    os: OS_DEFAULT,
    hostname: "",
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  // Proforma emitida al confirmar: su número es la referencia de la transferencia.
  const [numero, setNumero] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Errors = {};
    if (values.name.trim().length < 2) e.name = t("orderForm.errName");
    if (!emailRe.test(values.email)) e.email = t("orderForm.errEmail");
    if (!terms) e.terms = t("orderForm.errTerms");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(metodo: "tarjeta" | "transferencia") {
    setFormError(null);
    setPayError(null);
    if (!validate()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: plan.id, ...values, metodo, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.errors) setErrors(data.errors as Errors);
        setFormError(data?.error ?? t("orderForm.errRegister"));
        setStatus("idle");
        return;
      }
      // Con enlace de pago salimos a la pasarela; si no, se muestra la
      // transferencia con la referencia ya emitida.
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl as string;
        return;
      }
      if (metodo === "tarjeta") setPayError(t("orderForm.cardUnavailable"));
      setNumero((data.numero as string) ?? null);
      setStatus("done");
    } catch {
      setFormError(t("orderForm.errConnection"));
      setStatus("idle");
    }
  }

  const selectedRegion = regions?.find((r) => r.slug === values.region);
  const regionName = selectedRegion?.name;
  // SO que caben en el disco de este plan (p. ej. Win 11 exige 64 GB → fuera de Start).
  const osDisponibles = ofertablesParaDisco(discoGbDeTexto(plan.storage));
  // Solo las regiones conectadas a un Proxmox se entregan al instante: ahí tiene
  // sentido elegir SO y hostname. En las demás el pedido se gestiona a mano.
  const provisionable = !!selectedRegion?.provisionLocation;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Formulario */}
      <div>
        {status === "done" ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
            <div className="font-mono text-sm text-[var(--color-accent)]">● {t("orderForm.orderRegistered")}</div>
            <h2 className="mt-3 text-2xl font-semibold">
              {t("orderForm.allSet", { name: values.name.split(" ")[0] ?? values.name })}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              {t("orderForm.registeredPrefix")}
              <strong className="text-[var(--color-fg)]">{plan.name}</strong>
              {regionName ? t("orderForm.inRegion", { region: regionName }) : ""}
              {t("orderForm.registeredSuffix")}
            </p>
            {payError && (
              <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
                {payError}
              </p>
            )}
            {/* Transferencia con la referencia ya emitida (o el aviso de que llegará). */}
            <div className="mt-6">
              <BankTransfer
                reference={numero ?? undefined}
                amountLabel={numero ? eur(plan.price, 2) : undefined}
              />
            </div>
            {/* Aquí puede no haber sesión: /cuenta lleva al acceso y, tras entrar, al área de cliente. */}
            <Link
              href="/cuenta"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
            >
              {tc("goToAccount")} →
            </Link>
            <p className="mt-4 font-mono text-xs text-[var(--color-fg-dim)]">
              {t("orderForm.provisioningNote")}
            </p>
          </div>
        ) : (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              submit(stripeEnabled ? "tarjeta" : "transferencia");
            }}
            noValidate
            className="space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="name" required>
                  {t("orderForm.nameLabel")}
                </Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                  placeholder={t("orderForm.namePlaceholder")}
                  aria-invalid={!!errors.name}
                />
                <FieldError>{errors.name}</FieldError>
              </div>
              <div>
                <Label htmlFor="email" required>
                  {t("orderForm.emailLabel")}
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
                <Label htmlFor="region">{t("orderForm.regionLabel")}</Label>
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

            {provisionable && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="os">{t("orderForm.osLabel")}</Label>
                  <Select
                    id="os"
                    value={values.os}
                    onChange={(e) => setValues((v) => ({ ...v, os: e.target.value }))}
                  >
                    {osDisponibles.map((o) => (
                      <option key={o.slug} value={o.slug}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hostname">{t("orderForm.hostnameLabel")}</Label>
                  <Input
                    id="hostname"
                    value={values.hostname}
                    onChange={(e) => setValues((v) => ({ ...v, hostname: e.target.value }))}
                    placeholder={t("orderForm.hostnamePlaceholder")}
                    maxLength={60}
                  />
                  <p className="mt-1 font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
                    {t("orderForm.hostnameHint")}
                  </p>
                </div>
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
                  {t.rich("orderForm.termsAccept", {
                    terms: (c) => (
                      <Link href="/legal/terminos" className="text-[var(--color-accent)] underline">
                        {c}
                      </Link>
                    ),
                    privacy: (c) => (
                      <Link href="/legal/privacidad" className="text-[var(--color-accent)] underline">
                        {c}
                      </Link>
                    ),
                  })}
                </span>
              </label>
              <FieldError>{errors.terms}</FieldError>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {stripeEnabled && (
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
                >
                  {status === "sending" ? t("orderForm.submitSending") : t("orderForm.payByCard")}
                </button>
              )}
              <button
                type={stripeEnabled ? "button" : "submit"}
                onClick={stripeEnabled ? () => submit("transferencia") : undefined}
                disabled={status === "sending"}
                className={
                  stripeEnabled
                    ? "inline-flex w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 py-3.5 text-sm transition-colors hover:border-[var(--color-accent)] disabled:opacity-60 sm:w-auto"
                    : "inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
                }
              >
                {stripeEnabled
                  ? t("orderForm.payByTransfer")
                  : status === "sending"
                    ? t("orderForm.submitSending")
                    : `${t("orderForm.submitIdle")} →`}
              </button>
            </div>
            <p className="font-mono text-xs text-[var(--color-fg-dim)]">{t("orderForm.noCommit")}</p>
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
        <span className="mono-label text-[0.65rem]">{t("orderForm.summary")} · {lineTitle}</span>
        <h3 className="mt-2 text-xl font-semibold">{plan.name}</h3>
        {plan.popular && (
          <span className="mt-2 inline-block rounded bg-[var(--color-accent)] px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-wider text-black">
            {t("orderForm.popular")}
          </span>
        )}

        <dl className="mt-5 space-y-2.5 border-t border-[var(--color-line)] pt-5 text-sm">
          {specRows.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-4">
              <dt className="mono-label text-[0.6rem]">{t(`orderForm.${row.tKey}`)}</dt>
              <dd className="text-right text-[var(--color-fg)]">{plan[row.key] as string}</dd>
            </div>
          ))}
          {regionName && (
            <div className="flex items-start justify-between gap-4">
              <dt className="mono-label text-[0.6rem]">{t("orderForm.region")}</dt>
              <dd className="text-right text-[var(--color-accent)]">{regionName}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex items-baseline justify-between border-t border-[var(--color-line)] pt-5">
          <span className="text-sm text-[var(--color-fg-muted)]">{t("orderForm.monthlyTotal")}</span>
          <span className="font-mono text-2xl font-semibold">
            <Price value={plan.price} />
          </span>
        </div>
        <p className="mt-2 text-right font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
          {t("orderForm.vatNote")} · {site.brand}
        </p>
        {/* El cobro es siempre en euros; el dólar es solo una vista de referencia. */}
        <p className="c-usd mt-1 text-right font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
          {tc("currencyNote")}
        </p>
      </aside>
    </div>
  );
}
