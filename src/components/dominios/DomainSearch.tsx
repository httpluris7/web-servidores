"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Price } from "@/components/ui/Price";
import { BankTransfer } from "@/components/ui/BankTransfer";
import { eurPrecio } from "@/lib/utils";

type Resultado = { name: string; tld: string; disponible: boolean; precioEur: number | null };
type Elegido = { name: string; precioEur: number };
type Confirmacion = { numero: string | null; refPago: string | null; total: number };
type User = { nombre: string; email: string } | null;

/**
 * Buscador + contratación de dominios (Fase 2). La búsqueda aplica el margen en
 * servidor; al contratar, un formulario en línea (años + datos + método) emite la
 * proforma con el motor de pago de siempre. El registro real ocurre al pagar (CP3).
 */
export function DomainSearch({ user, initialQuery = "" }: { user: User; initialQuery?: string }) {
  const t = useTranslations("dominios");
  const locale = useLocale();
  const [q, setQ] = useState(initialQuery);
  const [estado, setEstado] = useState<"idle" | "buscando" | "ok" | "error" | "vacio" | "off">("idle");
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const [elegido, setElegido] = useState<Elegido | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);

  async function ejecutar(termino: string) {
    const t2 = termino.trim();
    if (!t2) return;
    setEstado("buscando");
    setResultados([]);
    setElegido(null);
    setConfirmacion(null);
    try {
      const res = await fetch(`/api/dominios/buscar?q=${encodeURIComponent(t2)}`);
      const j = await res.json().catch(() => null);
      if (res.status === 503) return setEstado("off");
      if (!res.ok || !j?.ok) return setEstado("error");
      setResultados(j.resultados as Resultado[]);
      setEstado((j.resultados as Resultado[]).length ? "ok" : "vacio");
    } catch {
      setEstado("error");
    }
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    void ejecutar(q);
  }

  // Si se llega con ?q=… (banner del home), busca automáticamente al montar.
  useEffect(() => {
    if (initialQuery.trim()) void ejecutar(initialQuery);
    // Solo al montar: la búsqueda manual se dispara desde el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const input =
    "min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-4 py-3 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none";

  // ---- Confirmación (tras emitir proforma por transferencia) ----
  if (confirmacion) {
    return (
      <div className="grid gap-5">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[var(--color-bg-raised)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-accent)]">{t("confirmTitle")}</h2>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            {t("confirmBody", { numero: confirmacion.numero ?? "—" })}
          </p>
          <p className="mt-4 text-sm">
            {t("total")}:{" "}
            <span className="font-semibold text-[var(--color-fg)]">
              <Price value={confirmacion.total} />
            </span>
          </p>
        </div>
        {confirmacion.refPago && (
          <BankTransfer reference={confirmacion.refPago} amountLabel={eurPrecio(confirmacion.total)} />
        )}
        <button
          type="button"
          onClick={() => {
            setConfirmacion(null);
            setElegido(null);
          }}
          className="justify-self-start text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          {t("backToSearch")}
        </button>
      </div>
    );
  }

  // ---- Formulario de contratación ----
  if (elegido) {
    return (
      <OrderForm
        elegido={elegido}
        locale={locale}
        user={user}
        onCancel={() => setElegido(null)}
        onDone={(c) => setConfirmacion(c)}
        onCardRedirect={(url) => (window.location.href = url)}
      />
    );
  }

  // ---- Búsqueda ----
  return (
    <div className="grid gap-6">
      <form onSubmit={buscar} className="flex flex-wrap gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("placeholder")}
          className={input}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={estado === "buscando" || !q.trim()}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {estado === "buscando" ? t("searching") : t("searchButton")}
        </button>
      </form>

      {estado === "off" && <p className="text-sm text-[var(--color-fg-muted)]">{t("unconfigured")}</p>}
      {estado === "error" && <p role="alert" className="text-sm text-[var(--color-danger)]">{t("errorProvider")}</p>}
      {estado === "vacio" && <p className="text-sm text-[var(--color-fg-muted)]">{t("noResults")}</p>}

      {estado === "ok" && (
        <ul className="grid gap-3">
          {resultados.map((r) => (
            <li
              key={r.name}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-4"
            >
              <span className="min-w-0 font-mono text-sm break-all text-[var(--color-fg)]">{r.name}</span>
              {r.disponible && r.precioEur != null ? (
                <span className="flex items-center gap-4">
                  <span className="text-sm">
                    <span className="font-semibold text-[var(--color-fg)]">
                      <Price value={r.precioEur} />
                    </span>
                    <span className="text-[var(--color-fg-muted)]"> {t("perYear")}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setElegido({ name: r.name, precioEur: r.precioEur! })}
                    className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  >
                    {t("order")}
                  </button>
                </span>
              ) : (
                <span className="text-xs text-[var(--color-fg-dim)]">{t("taken")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------- Formulario de pedido ------------------------- */

function OrderForm({
  elegido,
  locale,
  user,
  onCancel,
  onDone,
  onCardRedirect,
}: {
  elegido: Elegido;
  locale: string;
  user: User;
  onCancel: () => void;
  onDone: (c: Confirmacion) => void;
  onCardRedirect: (url: string) => void;
}) {
  const t = useTranslations("dominios");
  const [years, setYears] = useState(1);
  const [name, setName] = useState(user?.nombre ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [metodo, setMetodo] = useState<"transferencia" | "tarjeta">("transferencia");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = elegido.precioEur * years;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/dominios/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: elegido.name, years, name, email, metodo, locale }),
      });
      const j = await res.json().catch(() => null);
      if (res.status === 409) return setError(t("orderUnavailable"));
      if (!res.ok || !j?.ok) return setError(t("orderError"));
      if (j.paymentUrl) return onCardRedirect(j.paymentUrl as string);
      onDone({ numero: j.numero ?? null, refPago: j.refPago ?? null, total });
    } catch {
      setError(t("orderError"));
    } finally {
      setEnviando(false);
    }
  }

  const field =
    "w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none";

  // Contratar exige cuenta (como los VPS): sin sesión, acceso/registro.
  if (!user) {
    return (
      <div className="grid gap-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-mono text-lg break-all text-[var(--color-fg)]">{elegido.name}</h2>
          <span className="text-sm text-[var(--color-fg-muted)]">
            <Price value={elegido.precioEur} /> {t("perYear")}
          </span>
        </div>
        <p className="text-sm text-[var(--color-fg-muted)]">{t("accountNeeded")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/registro?next=/dominios"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
          >
            {t("createAccount")}
          </Link>
          <Link
            href="/acceder?next=/dominios"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 py-3 text-sm transition-colors hover:border-[var(--color-accent)]"
          >
            {t("logIn")}
          </Link>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="justify-self-start text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="grid gap-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-lg break-all text-[var(--color-fg)]">{elegido.name}</h2>
        <span className="text-sm text-[var(--color-fg-muted)]">
          <Price value={elegido.precioEur} /> {t("perYear")}
        </span>
      </div>

      <label className="grid gap-1.5">
        <span className="mono-label text-[0.6rem]">{t("yearsLabel")}</span>
        <select value={years} onChange={(e) => setYears(Number(e.target.value))} className={field}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? t("yearOne") : t("yearMany")}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="mono-label text-[0.6rem]">{t("nameLabel")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" />
        </label>
        <label className="grid gap-1.5">
          <span className="mono-label text-[0.6rem]">{t("emailLabel")}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" />
        </label>
      </div>

      <fieldset className="grid gap-2">
        <span className="mono-label text-[0.6rem]">{t("method")}</span>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="metodo" checked={metodo === "transferencia"} onChange={() => setMetodo("transferencia")} />
            {t("methodTransfer")}
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="metodo" checked={metodo === "tarjeta"} onChange={() => setMetodo("tarjeta")} />
            {t("methodCard")}
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
        <span className="text-sm">
          {t("total")}:{" "}
          <span className="font-semibold text-[var(--color-fg)]">
            <Price value={total} />
          </span>
        </span>
      </div>

      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={enviando || name.trim().length < 2 || !email.includes("@")}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {enviando ? t("submitting") : t("submit")}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]">
          {t("cancel")}
        </button>
      </div>

      <p className="text-xs text-[var(--color-fg-dim)]">{t("privacyNote")}</p>
    </form>
  );
}
