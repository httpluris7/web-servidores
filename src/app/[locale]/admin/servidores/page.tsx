import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ServerInventory } from "@/components/admin/ServerInventory";
import { avisosActivos, ETIQUETA, type AvisoActivo } from "@/lib/servidores/avisos";
import { buildInventory, type Inventory } from "@/lib/servidores/inventario";
import { ProviderError } from "@/lib/servidores/v4vm";

export const dynamic = "force-dynamic";

export default async function ServidoresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  // Un fallo del proveedor no debe dejar la página en blanco: se muestra el
  // aviso y el inventario vacío, y el botón de refrescar permite reintentar.
  let inventory: Inventory = {
    configured: false,
    items: [],
    externos: [],
    huerfanos: [],
    clientes: [],
    agentes: {},
  };
  let error: string | null = null;
  try {
    inventory = await buildInventory();
  } catch (err) {
    error = err instanceof ProviderError ? err.message : t("servidores.errorLoad");
  }

  // Los avisos abiertos no dependen del proveedor: se leen aunque su API falle.
  let avisos: AvisoActivo[] = [];
  try {
    avisos = await avisosActivos();
  } catch {
    // Un fallo aquí no debe dejar el inventario sin pintar.
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("servidores.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("servidores.subtitle")}</p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {avisos.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-5">
          <h2 className="text-sm font-semibold text-[var(--color-danger)]">
            {t("avisos.openHeading", { count: avisos.length })}
          </h2>
          <ul className="mt-3 grid gap-2">
            {avisos.map((a) => (
              <li
                key={`${a.servidorId}-${a.regla}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[var(--color-line)] pt-2 text-sm first:border-0 first:pt-0"
              >
                <Link
                  href={`/admin/servidores/${a.servidorId}`}
                  className="font-medium break-words hover:text-[var(--color-accent)]"
                >
                  {a.servidor}
                </Link>
                <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                  {a.regla === "agente"
                    ? t("avisos.openAgent", { min: a.umbral })
                    : t("avisos.openValue", {
                        metrica: ETIQUETA[a.regla],
                        valor: a.valor === null ? "—" : Math.round(a.valor),
                        umbral: a.umbral,
                      })}{" "}
                  · {new Date(a.desde).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ServerInventory initial={inventory} />
    </div>
  );
}
