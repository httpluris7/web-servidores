import { getTranslations, setRequestLocale } from "next-intl/server";
import { readLeads } from "@/lib/leads";
import { eur, fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default async function PedidosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const [pedidos, contactos] = await Promise.all([readLeads("pedido"), readLeads("contacto")]);

  return (
    <div className="grid gap-12">
      {/* Pedidos */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          {t("pedidos.orders")} <span className="font-mono text-sm text-[var(--color-fg-muted)]">({pedidos.length})</span>
        </h2>
        {pedidos.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">{t("pedidos.noOrders")}</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("pedidos.colCustomer")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("pedidos.colPlan")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("pedidos.colRegion")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem] text-right">{t("pedidos.colPrice")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("pedidos.colReceived")}</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{str(p.name) || "—"}</p>
                      <p className="text-xs text-[var(--color-fg-muted)]">{str(p.email)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {str(p.planName) || str(p.planId) || "—"}
                      {typeof p.qty === "number" && p.qty > 1 && (
                        <span className="font-mono text-xs text-[var(--color-fg-muted)]"> ×{p.qty}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fg-muted)]">{str(p.region) || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {typeof p.lineTotal === "number"
                        ? t("pedidos.perMonth", { price: eur(p.lineTotal) })
                        : typeof p.price === "number"
                          ? t("pedidos.perMonth", { price: eur(p.price) })
                          : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                      {fmtDate(str(p.receivedAt) || null, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Contactos */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          {t("pedidos.contactMessages")}{" "}
          <span className="font-mono text-sm text-[var(--color-fg-muted)]">({contactos.length})</span>
        </h2>
        {contactos.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">{t("pedidos.noContactMessages")}</p>
        ) : (
          <ul className="grid gap-3">
            {contactos.map((c, i) => (
              <li
                key={i}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-5 py-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{str(c.name) || "—"}</span>{" "}
                    <a
                      href={`mailto:${str(c.email)}`}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      {str(c.email)}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    {str(c.topic) && (
                      <span className="rounded-full border border-[var(--color-line-strong)] px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-[var(--color-fg-muted)]">
                        {str(c.topic)}
                      </span>
                    )}
                    <span className="font-mono text-xs text-[var(--color-fg-dim)]">
                      {fmtDate(str(c.receivedAt) || null, true)}
                    </span>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-[var(--color-fg-muted)]">
                  {str(c.message)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
