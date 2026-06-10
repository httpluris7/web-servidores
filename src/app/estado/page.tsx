import type { Metadata } from "next";
import { site } from "@/data/site";
import { regions } from "@/data/products";
import {
  services,
  regionStatus,
  incidents,
  statusMeta,
  overallStatus,
  type StatusLevel,
} from "@/data/status";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LiveTimestamp } from "@/components/status/LiveTimestamp";

export const metadata: Metadata = {
  title: "Estado del sistema",
  description: `Estado en tiempo real de los servicios y regiones de ${site.brand}: provisioning, red, mitigación DDoS y más.`,
  alternates: { canonical: "/estado" },
};

function StatusPill({ level }: { level: StatusLevel }) {
  const m = statusMeta[level];
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs" style={{ color: m.color }}>
      <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export default function StatusPage() {
  const overall = overallStatus();
  const allOk = overall === "operational";

  return (
    <>
      <PageHero
        index="/01"
        kicker="Estado del sistema"
        title={
          allOk ? (
            <>
              Todos los sistemas <span className="text-accent">operativos</span>.
            </>
          ) : (
            <>
              Estado <span className="text-accent">en vivo</span> del servicio.
            </>
          )
        }
        description="Disponibilidad de servicios y regiones en tiempo real. Suscríbete a las actualizaciones desde el panel."
      >
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-4 py-2 font-mono text-sm"
            style={{ borderColor: statusMeta[overall].color, color: statusMeta[overall].color }}
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusMeta[overall].dot}`} />
            {allOk ? "Operativo" : statusMeta[overall].label}
          </span>
          <LiveTimestamp />
        </div>
      </PageHero>

      {/* Servicios */}
      <section className="container-edge py-16 md:py-20">
        <SectionHeader index="/02" kicker="Servicios" title="Plataforma." />
        <ul className="mt-10 divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          {services.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-4 bg-[var(--color-bg-raised)] px-5 py-4">
              <div>
                <span className="text-sm font-medium">{s.name}</span>
                {s.note && <span className="mt-0.5 block text-xs text-[var(--color-fg-muted)]">{s.note}</span>}
              </div>
              <StatusPill level={s.status} />
            </li>
          ))}
        </ul>
      </section>

      {/* Regiones */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-16 md:py-20">
          <SectionHeader index="/03" kicker="Regiones" title="Cobertura europea." />
          <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-3">
            {regions.map((r) => {
              const level = regionStatus[r.slug] ?? "operational";
              return (
                <div key={r.slug} className="flex items-center justify-between bg-[var(--color-bg-raised)] px-5 py-4">
                  <span className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true">{r.flag}</span>
                    {r.city}
                  </span>
                  <StatusPill level={level} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Incidencias */}
      <section className="container-edge py-16 md:py-20">
        <SectionHeader index="/04" kicker="Histórico" title="Incidencias recientes." />
        <ul className="mt-10 space-y-4">
          {incidents.map((inc) => (
            <li
              key={inc.date + inc.title}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{inc.title}</h3>
                <span
                  className="font-mono text-xs"
                  style={{ color: inc.resolved ? "var(--color-accent)" : "#febc2e" }}
                >
                  {inc.resolved ? "● resuelto" : "● en seguimiento"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{inc.detail}</p>
              <p className="mt-2 font-mono text-xs text-[var(--color-fg-dim)]">{inc.date}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 font-mono text-xs text-[var(--color-fg-dim)]">
          {/* TODO: conectar a una fuente de monitorización real (status API). */}
          Datos de demostración · pendiente de conectar a monitorización real.
        </p>
      </section>
    </>
  );
}
