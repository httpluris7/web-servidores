import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Aplica el enrutado de idioma a todo MENOS: rutas API, assets de Next,
  // y cualquier fichero con extensión (favicon, og.svg, robots, sitemap…).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
