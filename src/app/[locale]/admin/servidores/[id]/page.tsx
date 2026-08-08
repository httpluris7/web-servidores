import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AgentePanel } from "@/components/admin/AgentePanel";
import { MetricasPanel } from "@/components/servidores/MetricasPanel";
import { listUsers } from "@/lib/auth";
import { providerConfig } from "@/lib/servidores/inventario";
import { getManagedById } from "@/lib/servidores/store";
import { getServer, type ProviderServer } from "@/lib/servidores/v4vm";

export const dynamic = "force-dynamic";

/**
 * Ficha de un servidor en el panel: sus gráficas de consumo y el alta del
 * agente que las alimenta. Vale igual para una máquina del proveedor que para
 * una externa; lo único que cambia es que de la externa no hay estado remoto
 * que enseñar.
 */
export default async function ServidorAdminPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const ficha = await getManagedById(id);
  if (!ficha) notFound();

  const [usuarios, cfg] = await Promise.all([listUsers(), providerConfig()]);
  const cliente = ficha.userId ? (usuarios.find((u) => u.id === ficha.userId) ?? null) : null;

  // El estado remoto es un extra: si la API falla, la pantalla sigue siendo
  // útil porque las métricas son nuestras.
  let remote: ProviderServer | null = null;
  if (ficha.proveedor === "v4vm" && cfg) {
    try {
      remote = await getServer(cfg, ficha.remoteId);
    } catch {
      remote = null;
    }
  }

  const nombre = ficha.etiqueta || remote?.name || `#${ficha.remoteId}`;
  const ip = remote?.ipv4[0] ?? ficha.host;

  const datos: Array<[string, string]> = [
    [t("servidores.colCustomer"), cliente ? `${cliente.nombre} ${cliente.apellidos}`.trim() || cliente.email : t("servidores.unassigned")],
    [t("servidores.detail.provider"), ficha.proveedor === "externo" ? t("servidores.detail.external") : "v4vm"],
  ];
  if (ip) datos.push([t("servidores.detail.address"), ip]);
  if (remote?.location) datos.push([t("servidores.detail.location"), remote.location]);
  if (remote?.plan) datos.push([t("servidores.detail.plan"), remote.plan]);
  if (remote) {
    datos.push([
      t("servidores.colSpecs"),
      [
        remote.vcpu !== null ? `${remote.vcpu} vCPU` : null,
        remote.ramMb !== null ? `${Math.round(remote.ramMb / 1024)} GB` : null,
        remote.diskGb !== null ? `${remote.diskGb} GB` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "—",
    ]);
  }

  return (
    <div className="grid gap-6">
      <header>
        <p className="mb-2 text-sm">
          <Link href="/admin/servidores" className="text-[var(--color-accent)] hover:underline">
            {t("servidores.detail.back")}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold break-words">{nombre}</h1>
        {ficha.notas && (
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{ficha.notas}</p>
        )}
      </header>

      <dl className="grid gap-x-6 gap-y-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 sm:grid-cols-2 lg:grid-cols-3">
        {datos.map(([k, v]) => (
          <div key={k} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-[var(--color-line)] pb-1.5">
            <dt className="text-xs text-[var(--color-fg-muted)]">{k}</dt>
            <dd className="truncate font-mono text-xs" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <AgentePanel
        id={ficha.id}
        activo={ficha.agenteTokenHash !== null}
        altaAt={ficha.agenteAltaAt}
        esExterno={ficha.proveedor === "externo"}
      />

      <MetricasPanel id={ficha.id} ambito="admin" />
    </div>
  );
}
