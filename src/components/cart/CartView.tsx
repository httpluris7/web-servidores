"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { regions } from "@/data/products";
import { site } from "@/data/site";
import { eur } from "@/lib/utils";

type InitialUser = { nombre: string; email: string } | null;

/** Enlace de pago final al panel externo, con UTM. */
const paymentHandoffUrl = `${site.billingUrl}${site.utm}`;

export function CartView({ initialUser }: { initialUser: InitialUser }) {
  const { lines, total, count, ready, setQty, setRegion, remove, clear } = useCart();
  // El usuario inicial llega del servidor (sin parpadeo). Si el checkout
  // responde 401 (sesión caducada) lo bajamos a null para mostrar el gate.
  const [user, setUser] = useState<InitialUser>(initialUser);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  async function completeOrder() {
    setFormError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ planId: l.planId, qty: l.qty, region: l.region })),
        }),
      });
      if (res.status === 401) {
        // La sesión ya no es válida: pedimos registro/acceso.
        setUser(null);
        setStatus("idle");
        setFormError("Your session has expired. Please log in again to complete the order.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(data?.error ?? "Could not complete the order. Try again.");
        setStatus("idle");
        return;
      }
      clear();
      setStatus("done");
    } catch {
      setFormError("Connection error. Check your network and try again.");
      setStatus("idle");
    }
  }

  // --- Estado: pedido completado -------------------------------------------
  if (status === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <div className="font-mono text-sm text-[var(--color-accent)]">● order registered</div>
        <h2 className="mt-3 text-2xl font-semibold">
          All set{user ? `, ${user.nombre.split(" ")[0]}` : ""}.
        </h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          We have registered your order. The last step is secure payment in the panel.
        </p>
        <a
          href={paymentHandoffUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          Go to secure payment →
        </a>
        <p className="mt-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/desplegar" className="text-[var(--color-accent)] hover:underline">
            Continue browsing plans
          </Link>
        </p>
      </div>
    );
  }

  // Antes de hidratar el carrito desde localStorage no sabemos su contenido.
  if (!ready) {
    return <p className="font-mono text-sm text-[var(--color-fg-dim)]">Loading cart…</p>;
  }

  // --- Estado: carrito vacío -----------------------------------------------
  if (count === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-10 text-center">
        <p className="text-lg font-medium">Your cart is empty</p>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Add a VPS or dedicated server to get started.
        </p>
        <Link
          href="/desplegar"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          Browse plans →
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
                <p className="font-mono text-lg font-semibold">{eur(l.subtotal)}</p>
                <p className="font-mono text-[0.65rem] text-[var(--color-fg-dim)]">/mo</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--color-line)] pt-4">
              {/* Selector de cantidad */}
              <div className="flex items-center gap-3">
                <span className="mono-label text-[0.6rem]">Qty</span>
                <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)]">
                  <button
                    type="button"
                    aria-label={`Decrease ${l.plan.name} quantity`}
                    onClick={() => setQty(l.planId, l.qty - 1)}
                    disabled={l.qty <= 1}
                    className="flex h-9 w-9 items-center justify-center text-lg text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-mono text-sm">{l.qty}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${l.plan.name} quantity`}
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
                  <span className="mono-label text-[0.6rem]">Region</span>
                  <select
                    value={l.region ?? regions[0]?.slug}
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

              <button
                type="button"
                onClick={() => remove(l.planId)}
                className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)]"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={clear}
          className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)]"
        >
          Empty cart
        </button>
      </div>

      {/* Resumen + checkout */}
      <aside className="h-fit rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 lg:sticky lg:top-24">
        <span className="mono-label text-[0.65rem]">Order summary</span>

        <dl className="mt-5 space-y-2.5 border-t border-[var(--color-line)] pt-5 text-sm">
          {lines.map((l) => (
            <div key={l.planId} className="flex items-start justify-between gap-4">
              <dt className="text-[var(--color-fg-muted)]">
                {l.plan.name}
                {l.qty > 1 && <span className="font-mono text-[var(--color-fg-dim)]"> ×{l.qty}</span>}
              </dt>
              <dd className="text-right font-mono text-[var(--color-fg)]">{eur(l.subtotal)}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex items-baseline justify-between border-t border-[var(--color-line)] pt-5">
          <span className="text-sm text-[var(--color-fg-muted)]">Monthly total</span>
          <span className="font-mono text-2xl font-semibold">{eur(total)}</span>
        </div>
        <p className="mt-2 text-right font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
          VAT not included · {site.brand}
        </p>

        <div className="mt-6 border-t border-[var(--color-line)] pt-6">
          {user ? (
            <>
              <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
                Ordering as <span className="text-[var(--color-fg)]">{user.email}</span>
              </p>
              <button
                type="button"
                onClick={completeOrder}
                disabled={status === "sending"}
                className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
              >
                {status === "sending" ? "Processing…" : "Complete order →"}
              </button>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
                To complete your order you need an account. It only takes a minute and your
                cart will be waiting for you.
              </p>
              <Link
                href="/registro?next=/carrito"
                className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
              >
                Create account to continue →
              </Link>
              <p className="mt-3 text-center text-sm text-[var(--color-fg-muted)]">
                Already have an account?{" "}
                <Link href="/acceder?next=/carrito" className="text-[var(--color-accent)] underline">
                  Log in
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
