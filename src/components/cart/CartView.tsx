"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import type { Region } from "@/data/products";
import { defaultVpsRegionSlug } from "@/lib/regions";
import { ofertablesParaDisco, discoGbDeTexto } from "@/lib/provisioner/os";
import { site } from "@/data/site";
import { eur } from "@/lib/utils";
import { Price, PriceSum } from "@/components/ui/Price";
import { BankTransfer } from "@/components/ui/BankTransfer";

type InitialUser = { nombre: string; email: string } | null;

export function CartView({
  initialUser,
  regions,
  stripeEnabled = false,
}: {
  initialUser: InitialUser;
  /** Ubicaciones donde desplegar un VPS; llegan de la página (catálogo en disco). */
  regions: Region[];
  /** ¿Hay pasarela configurada? Sin ella solo se ofrece la transferencia. */
  stripeEnabled?: boolean;
}) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { lines, count, ready, setQty, setRegion, setOs, setDomain, remove, clear } = useCart();
  // El usuario inicial llega del servidor (sin parpadeo). Si el checkout
  // responde 401 (sesión caducada) lo bajamos a null para mostrar el gate.
  const [user, setUser] = useState<InitialUser>(initialUser);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  // Datos de la proforma emitida, para enseñar su referencia en la confirmación.
  const [proforma, setProforma] = useState<{
    numero: string | null;
    refPago: string | null;
    total: number;
  } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  async function completeOrder(metodo: "tarjeta" | "transferencia") {
    setFormError(null);
    setPayError(null);
    setStatus("sending");
    // El carrito se vacía al confirmar; guardamos el total antes para poder
    // mostrar el importe exacto de la transferencia.
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            planId: l.planId,
            qty: l.qty,
            region: l.region,
            os: l.os,
            domain: l.domain,
          })),
          metodo,
          locale,
        }),
      });
      if (res.status === 401) {
        // La sesión ya no es válida: pedimos registro/acceso.
        setUser(null);
        setStatus("idle");
        setFormError(t("cartView.errorSessionExpired"));
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setFormError(data?.error ?? t("cartView.errorGeneric"));
        setStatus("idle");
        return;
      }

      clear();
      // Con enlace de pago salimos a la pasarela; si falló, la confirmación
      // muestra la transferencia y el motivo, sin perder el pedido.
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl as string;
        return;
      }
      if (metodo === "tarjeta") setPayError(t("cartView.cardUnavailable"));
      setProforma({
        numero: (data.numero as string) ?? null,
        refPago: (data.refPago as string) ?? null,
        total,
      });
      setStatus("done");
    } catch {
      setFormError(t("cartView.errorConnection"));
      setStatus("idle");
    }
  }

  // --- Estado: pedido completado -------------------------------------------
  if (status === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <div className="font-mono text-sm text-[var(--color-accent)]">{t("cartView.orderRegistered")}</div>
        <h2 className="mt-3 text-2xl font-semibold">
          {t("cartView.allSet")}{user ? `, ${user.nombre.split(" ")[0]}` : ""}.
        </h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          {/* No se muestra el nº de proforma (PRO-…): la referencia que el cliente
              necesita es el "Concepto" (VH…) del bloque de transferencia de abajo. */}
          {t("cartView.orderRegisteredText")}
        </p>
        {payError && (
          <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
            {payError}
          </p>
        )}
        {/* Transferencia con la referencia ya emitida (o el aviso de que llegará). */}
        <div className="mt-6">
          <BankTransfer
            reference={proforma?.refPago ?? undefined}
            amountLabel={proforma ? eur(proforma.total, 2) : undefined}
          />
        </div>
        <Link
          href="/cuenta"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          {tc("goToAccount")} →
        </Link>
        <p className="mt-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/desplegar" className="text-[var(--color-accent)] hover:underline">
            {t("cartView.continueBrowsing")}
          </Link>
        </p>
      </div>
    );
  }

  // Antes de hidratar el carrito desde localStorage no sabemos su contenido.
  if (!ready) {
    return <p className="font-mono text-sm text-[var(--color-fg-dim)]">{t("cartView.loading")}</p>;
  }

  // --- Estado: carrito vacío -----------------------------------------------
  if (count === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-10 text-center">
        <p className="text-lg font-medium">{t("cartView.emptyTitle")}</p>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          {t("cartView.emptyText")}
        </p>
        <Link
          href="/desplegar"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          {t("cartView.browsePlans")}
        </Link>
      </div>
    );
  }

  // --- Estado: carrito con artículos ---------------------------------------
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Líneas del carrito */}
      <div className="space-y-4">
        {lines.map((l) => (
          <div
            key={l.planId}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="mono-label text-[0.6rem]">{l.lineTitle}</span>
                <h3 className="mt-1 text-lg font-semibold">{l.plan.name}</h3>
                <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                  {l.plan.cpu} · {l.plan.ram}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold">
                  <Price value={l.subtotal} />
                </p>
                <p className="font-mono text-[0.65rem] text-[var(--color-fg-dim)]">/mo</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--color-line)] pt-4">
              {/* Selector de cantidad */}
              <div className="flex items-center gap-3">
                <span className="mono-label text-[0.6rem]">{t("cartView.qty")}</span>
                <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)]">
                  <button
                    type="button"
                    aria-label={t("cartView.decreaseQty", { plan: l.plan.name })}
                    onClick={() => setQty(l.planId, l.qty - 1)}
                    disabled={l.qty <= 1}
                    className="flex h-9 w-9 items-center justify-center text-lg text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-mono text-sm">{l.qty}</span>
                  <button
                    type="button"
                    aria-label={t("cartView.increaseQty", { plan: l.plan.name })}
                    onClick={() => setQty(l.planId, l.qty + 1)}
                    className="flex h-9 w-9 items-center justify-center text-lg text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Región (solo VPS) */}
              {l.isVps && regions.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="mono-label text-[0.6rem]">{t("cartView.region")}</span>
                  <select
                    value={l.region ?? defaultVpsRegionSlug(regions)}
                    onChange={(e) => setRegion(l.planId, e.target.value)}
                    className="appearance-none rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    {regions.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.name} — {r.city}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Sistema operativo (solo VPS): los que caben en el disco del plan */}
              {l.isVps && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="mono-label text-[0.6rem]">{t("cartView.os")}</span>
                  <select
                    value={l.os}
                    onChange={(e) => setOs(l.planId, e.target.value)}
                    className="appearance-none rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    {ofertablesParaDisco(discoGbDeTexto(l.plan.storage)).map((o) => (
                      <option key={o.slug} value={o.slug}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={() => remove(l.planId)}
                className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)]"
              >
                {t("cartView.remove")}
              </button>
            </div>

            {/* Dominio a alojar (solo hosting): opcional, vacío = temporal. */}
            {l.isHosting && (
              <div className="mt-4 border-t border-[var(--color-line)] pt-4">
                <label className="block">
                  <span className="mono-label text-[0.6rem]">{t("cartView.domainLabel")}</span>
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={l.domain ?? ""}
                    onChange={(e) => setDomain(l.planId, e.target.value)}
                    placeholder={t("cartView.domainPlaceholder")}
                    className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  />
                  <span className="mt-1.5 block text-xs text-[var(--color-fg-dim)]">
                    {t("cartView.domainHint")}
                  </span>
                </label>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={clear}
          className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)]"
        >
          {t("cartView.emptyCart")}
        </button>
      </div>

      {/* Resumen + checkout */}
      <aside className="h-fit rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 lg:sticky lg:top-24">
        <span className="mono-label text-[0.65rem]">{t("cartView.orderSummary")}</span>

        <dl className="mt-5 space-y-2.5 border-t border-[var(--color-line)] pt-5 text-sm">
          {lines.map((l) => (
            <div key={l.planId} className="flex items-start justify-between gap-4">
              <dt className="text-[var(--color-fg-muted)]">
                {l.plan.name}
                {l.qty > 1 && <span className="font-mono text-[var(--color-fg-dim)]"> ×{l.qty}</span>}
              </dt>
              <dd className="text-right font-mono text-[var(--color-fg)]">
                <Price value={l.subtotal} />
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex items-baseline justify-between border-t border-[var(--color-line)] pt-5">
          <span className="text-sm text-[var(--color-fg-muted)]">{t("cartView.monthlyTotal")}</span>
          {/* Suma de los subtotales, no el total convertido: así el desglose cuadra. */}
          <span className="font-mono text-2xl font-semibold">
            <PriceSum values={lines.map((l) => l.subtotal)} />
          </span>
        </div>
        <p className="mt-2 text-right font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
          {t("cartView.vatNotice", { brand: site.brand })}
        </p>
        {/* El cobro es siempre en euros; el dólar es solo una vista de referencia. */}
        <p className="c-usd mt-1 text-right font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
          {tc("currencyNote")}
        </p>

        <div className="mt-6 border-t border-[var(--color-line)] pt-6">
          {user ? (
            <>
              <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
                {t("cartView.orderingAs")} <span className="text-[var(--color-fg)]">{user.email}</span>
              </p>
              {stripeEnabled ? (
                <>
                  {/* Con pasarela el cliente elige; sin ella, un solo botón. */}
                  <button
                    type="button"
                    onClick={() => completeOrder("tarjeta")}
                    disabled={status === "sending"}
                    className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
                  >
                    {status === "sending" ? t("cartView.processing") : t("cartView.payByCard")}
                  </button>
                  <button
                    type="button"
                    onClick={() => completeOrder("transferencia")}
                    disabled={status === "sending"}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 py-3.5 text-sm transition-colors hover:border-[var(--color-accent)] disabled:opacity-60"
                  >
                    {t("cartView.payByTransfer")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => completeOrder("transferencia")}
                  disabled={status === "sending"}
                  className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
                >
                  {status === "sending" ? t("cartView.processing") : t("cartView.completeOrder")}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
                {t("cartView.accountNeeded")}
              </p>
              <Link
                href="/registro?next=/carrito"
                className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
              >
                {t("cartView.createAccountToContinue")}
              </Link>
              <p className="mt-3 text-center text-sm text-[var(--color-fg-muted)]">
                {t("cartView.haveAccount")}{" "}
                <Link href="/acceder?next=/carrito" className="text-[var(--color-accent)] underline">
                  {t("cartView.logIn")}
                </Link>
              </p>
            </>
          )}

          {formError && (
            <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
              {formError}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
