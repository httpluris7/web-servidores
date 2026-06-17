import "./globals.css";

/**
 * Layout raíz mínimo (passthrough).
 *
 * El `<html lang>` real, el <body>, los proveedores y el header/footer viven en
 * `app/[locale]/layout.tsx`, para poder fijar el idioma del documento por ruta
 * (en / es / fr). Aquí solo cargamos los estilos globales y dejamos pasar los
 * hijos. La única página que se renderiza fuera de [locale] es el 404 global
 * (`app/not-found.tsx`), que aporta su propio <html>/<body>.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
