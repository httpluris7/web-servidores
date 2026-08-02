import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import {
  esProforma,
  invoiceConcepto,
  listInvoices,
  PAYMENT_METHOD_LABEL,
  type Invoice,
} from "@/lib/facturas";
import { filtrarFacturas, invoiceZipName, parseInvoiceFilter } from "@/lib/facturas-filtro";
import { generateInvoicePdf, invoiceStatusEn } from "@/lib/invoice-pdf";
import { createZip, nombreSeguro, type ZipEntry } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tope de facturas por descarga. Cada PDF se dibuja en el momento y el zip se
 * arma entero en memoria, así que preferimos pedir un rango más estrecho antes
 * que bloquear el servidor con un lote enorme.
 */
const MAX_FACTURAS = 500;

/** Escapa un valor para CSV con separador `;`. */
function csv(valor: string | number): string {
  const s = String(valor);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNAS = [
  "Number",
  "Fiscal number",
  "Status",
  "Issue date",
  "Payment date",
  "Due date",
  "Customer",
  "Email",
  "Description",
  "Net",
  "Tax %",
  "Total",
  "Payment method",
];

/** Resumen del lote en CSV, que es lo que se lleva a la contabilidad. */
function resumenCsv(facturas: Invoice[]): Buffer {
  const filas = facturas.map((f) =>
    [
      f.numero,
      f.numeroFactura ?? "",
      invoiceStatusEn(f.estado),
      f.emitidaAt.slice(0, 10),
      f.pagadaAt ? f.pagadaAt.slice(0, 10) : "",
      f.vencimientoAt.slice(0, 10),
      f.clienteNombre,
      f.clienteEmail,
      invoiceConcepto(f),
      f.base.toFixed(2),
      f.ivaPct,
      f.total.toFixed(2),
      f.metodoPago ? PAYMENT_METHOD_LABEL[f.metodoPago] : "",
    ]
      .map(csv)
      .join(";")
  );
  const cuerpo = [COLUMNAS.join(";"), ...filas].join("\r\n") + "\r\n";
  // BOM: sin él, Excel abre el CSV en latin-1 y destroza los acentos.
  return Buffer.concat([Buffer.from("\uFEFF", "utf8"), Buffer.from(cuerpo, "utf8")]);
}

/**
 * Descarga en lote de las facturas que cumplen el filtro (fechas + estado),
 * como un zip con un PDF por factura y un `resumen.csv`. Mismo filtro que la
 * tabla del panel, así que lo que se ve es exactamente lo que se descarga.
 */
export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  const filtro = parseInvoiceFilter(new URL(req.url).searchParams);
  const facturas = filtrarFacturas(await listInvoices(), filtro);

  if (facturas.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No invoices match this selection." },
      { status: 404 }
    );
  }
  if (facturas.length > MAX_FACTURAS) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many invoices (${facturas.length}). Narrow the date range: ${MAX_FACTURAS} max per download.`,
      },
      { status: 413 }
    );
  }

  // Las más antiguas primero: dentro del zip se leen en orden cronológico.
  const orden = [...facturas].reverse();
  const usados = new Set<string>();
  const entradas: ZipEntry[] = [];

  for (const f of orden) {
    const base = nombreSeguro(
      `${esProforma(f) ? "proforma" : "invoice"}-${f.numero}`,
      `invoice-${f.id.slice(0, 8)}`
    );
    // Dos facturas no deberían compartir número, pero un duplicado no puede
    // hacer que se pierda un PDF dentro del zip.
    let nombre = `${base}.pdf`;
    for (let n = 2; usados.has(nombre); n++) nombre = `${base}-${n}.pdf`;
    usados.add(nombre);

    entradas.push({ name: nombre, data: await generateInvoicePdf(f), date: new Date(f.emitidaAt) });
  }

  entradas.push({ name: "resumen.csv", data: resumenCsv(orden) });

  const zip = createZip(entradas);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${invoiceZipName(filtro)}"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "private, no-store",
    },
  });
}
