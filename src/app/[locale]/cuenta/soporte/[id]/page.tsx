import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { TicketStatusBadge } from "@/components/ui/TicketStatusBadge";
import { TicketThread } from "@/components/cuenta/TicketThread";
import { getSession } from "@/lib/session";
import { esIdTicket, getTicketForUser } from "@/lib/tickets";
import { syncTicketMail } from "@/lib/tickets-mail";
import { fmtDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tickets" });
  return {
    title: t("detail.metaTitle"),
    description: t("metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function TicketClientePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tickets");

  const session = await getSession();
  if (!session) redirect("/acceder");

  if (!esIdTicket(id)) notFound();
  // Trae al hilo lo respondido desde el buzón antes de pintarlo.
  await syncTicketMail();
  // Único punto de comprobación de pertenencia: si no es suyo, no existe.
  const ticket = await getTicketForUser(id, session.uid);
  if (!ticket) notFound();

  return (
    <>
      <PageHero
        index="/04"
        kicker={ticket.numero}
        title={<span className="break-words">{ticket.asunto}</span>}
        description={t("detail.description")}
      />

      <section className="container-edge max-w-3xl py-16 md:py-20">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/cuenta/soporte" className="text-[var(--color-accent)] hover:underline">
            {t("detail.backToList")}
          </Link>
        </p>

        <dl className="mb-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3">
          <div className="bg-[var(--color-bg-raised)] px-5 py-4">
            <dt className="mono-label text-[0.6rem]">{t("detail.statusLabel")}</dt>
            <dd className="mt-2">
              <TicketStatusBadge estado={ticket.estado} />
            </dd>
          </div>
          <div className="bg-[var(--color-bg-raised)] px-5 py-4">
            <dt className="mono-label text-[0.6rem]">{t("detail.categoryLabel")}</dt>
            <dd className="mt-1.5 text-sm">{t(`category.${ticket.categoria}`)}</dd>
          </div>
          <div className="bg-[var(--color-bg-raised)] px-5 py-4">
            <dt className="mono-label text-[0.6rem]">
              {ticket.servidorEtiqueta ? t("detail.serverLabel") : t("detail.createdLabel")}
            </dt>
            <dd className="mt-1.5 text-sm break-words">
              {ticket.servidorEtiqueta || fmtDate(ticket.creadoAt)}
            </dd>
          </div>
        </dl>

        <TicketThread
          id={ticket.id}
          estado={ticket.estado}
          // Al cliente solo le llega quién escribió (él o soporte) y cuándo: el
          // `nombre` guardado en las respuestas es el correo del administrador.
          mensajes={ticket.mensajes.map((m) => ({
            id: m.id,
            autor: m.autor,
            cuerpo: m.cuerpo,
            creadoAt: m.creadoAt,
          }))}
        />
      </section>
    </>
  );
}
