import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Wrappers de navegación con idioma. Usa SIEMPRE estos `Link`, `redirect`,
 * `useRouter`, `usePathname` en lugar de los de `next/navigation`/`next/link`
 * en las partes localizadas: añaden/conservan el prefijo de idioma automáticamente.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
