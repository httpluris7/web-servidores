import { getTranslations, setRequestLocale } from "next-intl/server";
import { ServerInventory } from "@/components/admin/ServerInventory";
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
  let inventory: Inventory = { configured: false, items: [], huerfanos: [], clientes: [] };
  let error: string | null = null;
  try {
    inventory = await buildInventory();
  } catch (err) {
    error = err instanceof ProviderError ? err.message : t("servidores.errorLoad");
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

      <ServerInventory initial={inventory} />
    </div>
  );
}
