import { eur } from "@/lib/utils";
import { usd } from "@/lib/currency";

/**
 * Importe con doble divisa.
 *
 * Pinta el precio en euros y en dólares; el CSS de `globals.css` muestra solo el
 * que corresponde al `data-currency` del <html>. Es un componente sin estado ni
 * "use client", así que sirve igual en Server Components (páginas estáticas) que
 * dentro de componentes de cliente, y el importe correcto ya viene en el HTML
 * (sin parpadeo ni mismatch de hidratación).
 *
 * El elemento oculto lo está con `display: none`, que también lo saca del árbol
 * de accesibilidad: los lectores de pantalla leen un único precio.
 */
export function Price({ value }: { value: number }) {
  return (
    <>
      <span className="c-eur">{eur(value)}</span>
      <span className="c-usd">{usd(value)}</span>
    </>
  );
}
