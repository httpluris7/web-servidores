import type { Invoice } from "@/lib/facturas";

/**
 * Filtro de facturas por fecha y estado, compartido por la pantalla del panel
 * y por la descarga en lote. Vive aparte de `lib/facturas.ts` a propósito: ese
 * módulo abre `node:fs` y no puede entrar en el bundle del navegador, mientras
 * que esto son datos puros que el formulario del panel también necesita.
 *
 * Las fechas van como `YYYY-MM-DD` (lo que produce `<input type="date">`) y se
 * comparan como texto contra el trozo de fecha del ISO guardado, que es UTC.
 * El servidor corre en UTC, así que lo que se filtra coincide con lo que se ve
 * en la tabla.
 */

/** Estados por los que se puede filtrar; `todas` desactiva el criterio. */
export const INVOICE_FILTER_STATES = ["todas", "pagada", "pendiente", "cancelada"] as const;
export type InvoiceFilterState = (typeof INVOICE_FILTER_STATES)[number];

/**
 * Fecha sobre la que se aplica el rango. Para impuestos suele importar la de
 * cobro: es cuando la proforma se convierte en factura de la serie fiscal.
 */
export const INVOICE_DATE_FIELDS = ["emision", "pago"] as const;
export type InvoiceDateField = (typeof INVOICE_DATE_FIELDS)[number];

export type InvoiceFilter = {
  desde: string | null; // YYYY-MM-DD, incluido
  hasta: string | null; // YYYY-MM-DD, incluido
  estado: InvoiceFilterState;
  campo: InvoiceDateField;
};

export const FILTRO_FACTURAS_VACIO: InvoiceFilter = {
  desde: null,
  hasta: null,
  estado: "todas",
  campo: "emision",
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function primero(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function fechaValida(raw: string): string | null {
  if (!FECHA_RE.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Descarta cosas como 2026-02-31, que `Date` acepta desbordando el mes.
  return d.toISOString().slice(0, 10) === raw ? raw : null;
}

/** Lee el filtro de los parámetros de la URL, ignorando lo que no sea válido. */
export function parseInvoiceFilter(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): InvoiceFilter {
  const get = (k: string) =>
    params instanceof URLSearchParams ? (params.get(k) ?? "") : primero(params[k]);

  let desde = fechaValida(get("desde"));
  let hasta = fechaValida(get("hasta"));
  // Rango del revés: lo enderezamos en vez de devolver una lista vacía.
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];

  const estadoRaw = get("estado");
  const campoRaw = get("campo");

  return {
    desde,
    hasta,
    estado: (INVOICE_FILTER_STATES as readonly string[]).includes(estadoRaw)
      ? (estadoRaw as InvoiceFilterState)
      : "todas",
    campo: (INVOICE_DATE_FIELDS as readonly string[]).includes(campoRaw)
      ? (campoRaw as InvoiceDateField)
      : "emision",
  };
}

/** Query string canónica del filtro (vacía si no filtra nada). */
export function invoiceFilterQuery(f: InvoiceFilter): string {
  const p = new URLSearchParams();
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (f.estado !== "todas") p.set("estado", f.estado);
  // El campo de fecha solo cambia algo si hay rango.
  if (f.campo !== "emision" && (f.desde || f.hasta)) p.set("campo", f.campo);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function invoiceFilterIsEmpty(f: InvoiceFilter): boolean {
  return !f.desde && !f.hasta && f.estado === "todas";
}

/** Fecha (YYYY-MM-DD) por la que se compara esta factura; null si no la tiene. */
export function invoiceFilterDate(inv: Invoice, campo: InvoiceDateField): string | null {
  const iso = campo === "pago" ? inv.pagadaAt : inv.emitidaAt;
  return iso ? iso.slice(0, 10) : null;
}

export function matchesInvoiceFilter(inv: Invoice, f: InvoiceFilter): boolean {
  if (f.estado !== "todas" && inv.estado !== f.estado) return false;
  if (!f.desde && !f.hasta) return true; // sin rango no se mira la fecha

  const fecha = invoiceFilterDate(inv, f.campo);
  // Filtrando por fecha de cobro, lo que no se ha cobrado queda fuera.
  if (!fecha) return false;
  if (f.desde && fecha < f.desde) return false;
  if (f.hasta && fecha > f.hasta) return false;
  return true;
}

export function filtrarFacturas(list: Invoice[], f: InvoiceFilter): Invoice[] {
  return list.filter((inv) => matchesInvoiceFilter(inv, f));
}

/** Nombre del zip: `facturas-pagadas-2026-08-01_2026-11-02.zip`. */
export function invoiceZipName(f: InvoiceFilter): string {
  const partes = ["facturas"];
  if (f.estado !== "todas") partes.push(f.estado === "pendiente" ? "proforma" : f.estado + "s");
  if (f.desde || f.hasta) partes.push(`${f.desde ?? "inicio"}_${f.hasta ?? "hoy"}`);
  return `${partes.join("-")}.zip`;
}
