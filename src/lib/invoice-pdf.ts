import PDFDocument from "pdfkit";
import { site } from "@/data/site";
import type { Invoice, InvoiceStatus } from "@/lib/facturas";

/**
 * Genera el PDF de una factura (en inglés, para una cartera internacional).
 * Sin navegador: se dibuja con pdfkit (fuentes estándar Helvetica). La moneda
 * se muestra como `EUR 0.00` (currencyDisplay: code) para evitar cualquier
 * problema de glifo con el símbolo €.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const invoiceMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export const invoiceDateEn = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" }).format(
    new Date(iso)
  );

export const invoiceStatusEn = (s: InvoiceStatus) =>
  ({ pendiente: "Pending payment", pagada: "Paid", cancelada: "Cancelled" })[s];

export function generateInvoicePdf(inv: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    const ink = "#0b0f17";
    const muted = "#55607a";
    const faint = "#8a93a6";
    const line = "#e5e8ee";

    // --- Cabecera: marca (izq) + INVOICE (der) ---
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(20).text(site.brand, left, 50);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(ink).text("INVOICE", left, 50, {
      width,
      align: "right",
    });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(muted)
      .text(inv.numero, left, 74, { width, align: "right" })
      .text(invoiceStatusEn(inv.estado), left, 88, { width, align: "right" });

    // --- Emisor ---
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ink).text(site.legal.companyName, left, 80);
    doc.font("Helvetica").fillColor(muted);
    doc.text(site.legal.taxId, left, doc.y);
    doc.text(site.legal.address, left, doc.y, { width: width * 0.6 });
    doc.text(site.contact.support, left, doc.y);

    // --- Bill to + fechas ---
    const blockY = Math.max(doc.y + 22, 155);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(faint).text("BILL TO", left, blockY);
    doc.font("Helvetica").fontSize(10).fillColor(ink).text(inv.clienteNombre, left, blockY + 12);
    doc.fillColor(muted).fontSize(9).text(inv.clienteEmail, left, doc.y);

    const dx = left + width * 0.55;
    let dy = blockY;
    const dateRow = (label: string, val: string) => {
      doc.font("Helvetica").fontSize(9).fillColor(faint).text(label, dx, dy, { width: width * 0.2 });
      doc.fillColor(ink).text(val, dx, dy, { width: width * 0.45, align: "right" });
      dy += 15;
    };
    dateRow("Issue date", invoiceDateEn(inv.emitidaAt));
    dateRow("Due date", invoiceDateEn(inv.vencimientoAt));
    if (inv.pagadaAt) dateRow("Payment date", invoiceDateEn(inv.pagadaAt));

    // --- Tabla de líneas ---
    let ty = Math.max(doc.y, dy) + 22;
    const cQtyW = width * 0.1;
    const cUnitW = width * 0.16;
    const cAmtW = width * 0.16;
    const cQtyX = right - cQtyW - cUnitW - cAmtW;
    const cUnitX = right - cUnitW - cAmtW;
    const cAmtX = right - cAmtW;
    const descW = cQtyX - left - 8;

    doc.font("Helvetica-Bold").fontSize(7).fillColor(faint);
    doc.text("DESCRIPTION", left, ty);
    doc.text("QTY", cQtyX, ty, { width: cQtyW, align: "right" });
    doc.text("UNIT PRICE", cUnitX, ty, { width: cUnitW, align: "right" });
    doc.text("AMOUNT", cAmtX, ty, { width: cAmtW, align: "right" });
    ty += 13;
    doc.moveTo(left, ty).lineTo(right, ty).strokeColor(line).lineWidth(1).stroke();
    ty += 8;

    for (const l of inv.lineas) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(ink).text(l.concepto, left, ty, {
        width: descW,
      });
      let rowBottom = doc.y;
      if (l.descripcion) {
        doc.font("Helvetica").fontSize(8).fillColor(faint).text(l.descripcion, left, doc.y, {
          width: descW,
        });
        rowBottom = doc.y;
      }
      doc.font("Helvetica").fontSize(9).fillColor(ink);
      doc.text(String(l.cantidad), cQtyX, ty, { width: cQtyW, align: "right" });
      doc.text(invoiceMoney(l.precioUnitario), cUnitX, ty, { width: cUnitW, align: "right" });
      doc.text(invoiceMoney(l.subtotal), cAmtX, ty, { width: cAmtW, align: "right" });
      ty = rowBottom + 8;
      doc.moveTo(left, ty).lineTo(right, ty).strokeColor("#eef1f6").lineWidth(0.5).stroke();
      ty += 8;
    }

    // --- Totales ---
    const tLabelX = left + width * 0.55;
    const tValW = width * 0.25;
    const tValX = right - tValW;
    const totalRow = (label: string, val: string, bold = false) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 11 : 9)
        .fillColor(bold ? ink : muted)
        .text(label, tLabelX, ty, { width: width * 0.2 });
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor(ink)
        .text(val, tValX, ty, { width: tValW, align: "right" });
      ty += bold ? 20 : 16;
    };

    ty += 4;
    if (inv.ivaPct > 0) {
      totalRow("Subtotal", invoiceMoney(inv.base));
      totalRow(`Tax (${inv.ivaPct}%)`, invoiceMoney(round2(inv.total - inv.base)));
    }
    doc.moveTo(tLabelX, ty).lineTo(right, ty).strokeColor(line).lineWidth(1).stroke();
    ty += 6;
    totalRow("Total", invoiceMoney(inv.total), true);
    if (inv.ivaPct === 0) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(faint)
        .text("Prices exclude tax.", tLabelX, ty, { width: width * 0.45, align: "right" });
      ty += 14;
    }

    // --- Notas ---
    if (inv.notas) {
      ty += 12;
      doc.font("Helvetica-Bold").fontSize(7).fillColor(faint).text("NOTES", left, ty);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(muted)
        .text(inv.notas, left, doc.y + 2, { width });
    }

    // --- Pie legal ---
    const footerY = doc.page.height - doc.page.margins.bottom - 34;
    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor(line).lineWidth(1).stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(faint)
      .text(
        `${site.legal.companyName}  ·  ${site.legal.taxId}  ·  ${site.legal.jurisdiction}`,
        left,
        footerY + 8,
        { width, align: "center" }
      )
      .text(
        "Thank you for your business. Invoice generated electronically; valid without a signature.",
        left,
        doc.y + 2,
        { width, align: "center" }
      );

    doc.end();
  });
}
