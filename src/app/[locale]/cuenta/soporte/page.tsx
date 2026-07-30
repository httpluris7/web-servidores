import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { TicketStatusBadge } from "@/components/ui/TicketStatusBadge";
import { NewTicketForm, type TicketServerOption } from "@/components/cuenta/NewTicketForm";
import { getSession } from "@/lib/session";
import { listTicketsByUser } from "@/lib/tickets";
import { syncTicketMail } from "@/lib/tickets-mail";
import { listManagedByUser } from "@/lib/servidores/store";
import { fmtDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tickets" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function SoporteClientePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tickets");

  const session = await getSession();
  if (!session) redirect("/acceder");

  // Antes de listar, incorporamos lo que se haya respondido desde el buzón: es
  // lo que hace que el hilo de la web no se quede atrás. Va limitada en el
  // tiempo y nunca lanza.
  await syncTicketMail();
  const tickets = await listTicketsByUser(session.uid);

  // Solo la ficha local: para el desplegable no hace falta llamar al proveedor
  // (que limita el ritmo), basta con la etiqueta que ya tenemos guardada.
  const servidores: TicketServerOption[] = (await listManagedByUser(session.uid)).map((s) => ({
    id: s.id,
    label: s.etiqueta || `#${s.remoteId}`,
  }));

  return (
    <>
      <PageHero
        index="/04"
        kicker={t("kicker")}
        title={
          <>
            {t("titleA")} <span className="text-accent">{t("titleB")}</span>
          </>
        }
        description={t("description")}
      />

      <section className="container-edge max-w-3xl py-16 md:py-20">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/cuenta" className="text-[var(--color-accent)] hover:underline">
            {t("backToAccount")}
          </Link>
        </p>

        <section>
          <h2 className="mono-label mb-1">{t("newHeading")}</h2>
          <p className="mb-6 text-sm text-[var(--color-fg-muted)]">{t("newIntro")}</p>
          <NewTicketForm servers={servidores} />
        </section>

        <section className="mt-14 border-t border-[var(--color-line)] pt-10">
          <h2 className="mono-label mb-5">{t("listHeading")}</h2>

          {tickets.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">{t("empty")}</p>
          ) : (
            <ul className="grid gap-3">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/cuenta/soporte/${ticket.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-5 py-4 transition-colors hover:border-[var(--color-accent)]"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-[var(--color-fg-muted)]">
                        {ticket.numero}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-[var(--color-fg)]">
                        {ticket.asunto}
                      </p>
                      <p className="mt-1 font-mono text-[0.7rem] text-[var(--color-fg-dim)]">
                        {fmtDate(ticket.actualizadoAt, true)} ·{" "}
                        {t("messageCount", { count: ticket.mensajes.length })}
                      </p>
                    </div>
                    <TicketStatusBadge estado={ticket.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </>
  );
}
