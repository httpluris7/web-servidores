import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { routing } from "./routing";

/**
 * Carga y fusiona TODOS los diccionarios de un idioma.
 *
 * Los mensajes viven en /messages/{en,es,fr}/*.json, un fichero por sección
 * (chrome, home, vps, contacto…). Así cada página tiene su propio fichero y se
 * pueden traducir en paralelo sin conflictos. Aquí los fusionamos en un único
 * objeto de mensajes por petición.
 */
function loadMessages(locale: string): Record<string, unknown> {
  const dir = join(process.cwd(), "messages", locale);
  const merged: Record<string, unknown> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const content = JSON.parse(readFileSync(join(dir, file), "utf8"));
    Object.assign(merged, content);
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: loadMessages(locale),
  };
});
