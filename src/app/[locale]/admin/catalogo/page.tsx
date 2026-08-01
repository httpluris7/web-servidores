import { setRequestLocale } from "next-intl/server";
import { readCatalogo } from "@/lib/catalogo/store";
import { CatalogoManager } from "@/components/admin/CatalogoManager";

/** El catálogo se edita aquí mismo: nunca debe servirse una copia cacheada. */
export const dynamic = "force-dynamic";

export default async function AdminCatalogoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Sin filtrar por `visible` ni resolver idiomas: el panel edita el almacén
  // crudo, no la vista pública que arma `@/data/products`.
  const catalogo = await readCatalogo();

  return <CatalogoManager catalogo={catalogo} />;
}
