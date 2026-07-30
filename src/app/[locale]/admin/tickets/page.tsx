import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TicketStatusBadge } from "@/components/ui/TicketStatusBadge";
import { listTickets, ticketsAbiertos } from "@/lib/tickets";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const tickets = await listTickets();
  const pendientes = ticketsAbiertos(tickets);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("tickets.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          {pendientes > 0 ? t("tickets.subtitlePending", { count: pendientes }) : t("tickets.subtitle")}
        </p>
      </header>

      {tickets.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">{t("tickets.empty")}</p>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] md:overflow-x-auto">
          <table className="table-cards w-full border-collapse text-sm md:min-w-[680px]">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("tickets.colTicket")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("tickets.colCustomer")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("tickets.colStatus")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("tickets.colUpdated")}</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td data-label={t("tickets.colTicket")} className="px-4 py-3">
                    <Link
                      href={`/admin/tickets/${ticket.id}`}
                      className="font-mono text-xs text-[var(--color-accent)] hover:underline"
                    >
                      {ticket.numero}
                    </Link>
                    <p className="mt-0.5 break-words">{ticket.asunto}</p>
                  </td>
                  <td data-label={t("tickets.colCustomer")} className="px-4 py-3">
                    <p className="font-medium break-words">{ticket.clienteNombre}</p>
                    <p className="text-xs break-words text-[var(--color-fg-muted)]">
                      {ticket.clienteEmail}
                    </p>
                  </td>
                  <td data-label={t("tickets.colStatus")} className="px-4 py-3">
                    <TicketStatusBadge estado={ticket.estado} />
                  </td>
                  <td
                    data-label={t("tickets.colUpdated")}
                    className="px-4 py-3 font-mono text-xs text-[var(--color-fg-muted)]"
                  >
                    {fmtDate(ticket.actualizadoAt, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
