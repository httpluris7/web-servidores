import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TicketStatusBadge } from "@/components/ui/TicketStatusBadge";
import { TicketReplyForm } from "@/components/admin/TicketReplyForm";
import { esIdTicket, getTicketById } from "@/lib/tickets";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const tc = await getTranslations("tickets");

  if (!esIdTicket(id)) notFound();
  const ticket = await getTicketById(id);
  if (!ticket) notFound();

  const meta: { label: string; value: string }[] = [
    { label: t("tickets.detail.customer"), value: ticket.clienteNombre },
    { label: t("tickets.detail.email"), value: ticket.clienteEmail },
    { label: t("tickets.detail.category"), value: tc(`category.${ticket.categoria}`) },
    {
      label: t("tickets.detail.server"),
      value: ticket.servidorEtiqueta || "—",
    },
    { label: t("tickets.detail.created"), value: fmtDate(ticket.creadoAt, true) },
  ];

  return (
    <div className="grid gap-6">
      <p className="text-sm">
        <Link href="/admin/tickets" className="text-[var(--color-accent)] hover:underline">
          {t("tickets.detail.back")}
        </Link>
      </p>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm text-[var(--color-fg-muted)]">{ticket.numero}</p>
          <h1 className="mt-1 text-2xl font-semibold break-words">{ticket.asunto}</h1>
        </div>
        <TicketStatusBadge estado={ticket.estado} />
      </header>

      <dl className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-3">
        {meta.map((m) => (
          <div key={m.label} className="bg-[var(--color-bg-raised)] px-5 py-4">
            <dt className="mono-label text-[0.6rem]">{m.label}</dt>
            <dd className="mt-1 text-sm break-words">{m.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="grid gap-4">
        {ticket.mensajes.map((m) => {
          const nuestro = m.autor === "soporte";
          return (
            <li
              key={m.id}
              className={`min-w-0 rounded-[var(--radius-lg)] border p-5 ${
                nuestro
                  ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
                  : "border-[var(--color-line)] bg-[var(--color-bg-raised)]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="mono-label text-[0.6rem]">
                  {nuestro ? t("tickets.detail.byUs") : t("tickets.detail.byCustomer")}
                  {m.nombre ? ` · ${m.nombre}` : ""}
                </p>
                <p className="font-mono text-[0.7rem] text-[var(--color-fg-dim)]">
                  {fmtDate(m.creadoAt, true)}
                </p>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap break-words text-[var(--color-fg)]">
                {m.cuerpo}
              </p>
            </li>
          );
        })}
      </ul>

      <TicketReplyForm id={ticket.id} estado={ticket.estado} />
    </div>
  );
}
