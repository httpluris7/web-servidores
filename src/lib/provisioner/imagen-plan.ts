import "server-only";
import { readCatalogo } from "@/lib/catalogo/store";
import { AI_DEVELOPER_OS } from "./os";

/**
 * Imagen de SO propia del plan de un servidor, o `null` si el plan no tiene.
 *
 * Hoy solo los planes de la familia AI Developer VPS (`tipo: "ai-vps"`) tienen
 * imagen propia. Sirve para que el panel ofrezca "volver a la imagen de fábrica"
 * al reinstalar SOLO a esos servidores: la plantilla vive en la misma ubicación
 * que los Cloud VPS normales, pero no es para ellos.
 *
 * Se mira el catálogo completo (también los planes ocultos): retirar un plan
 * del escaparate no le quita su imagen a quien ya lo tiene contratado.
 */
export async function imagenPropiaDePlan(planSlug: string | null | undefined): Promise<string | null> {
  if (!planSlug) return null;
  try {
    const { categorias, productos } = await readCatalogo();
    const prod = productos.find((p) => p.planId === planSlug);
    if (!prod) return null;
    const tipo = categorias.find((c) => c.id === prod.categoriaId)?.tipo;
    return tipo === "ai-vps" ? AI_DEVELOPER_OS : null;
  } catch {
    return null;
  }
}
