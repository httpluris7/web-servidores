import PDFDocument from "pdfkit";
import { site } from "@/data/site";
import { BANK_LABEL_EN, bankReferenceNoteEn, bankRows } from "@/lib/bank";
import {
  esProforma,
  PAYMENT_METHOD_LABEL,
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod,
} from "@/lib/facturas";

export const paymentMethodEn = (m: PaymentMethod | null) => (m ? PAYMENT_METHOD_LABEL[m] : null);

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

    const proforma = esProforma(inv);
    const paid = inv.estado === "pagada";

    // --- Cabecera: marca (izq) + PROFORMA / INVOICE (der) ---
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(20).text(site.brand, left, 50);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(ink).text(proforma ? "PROFORMA" : "INVOICE", left, 50, {
      width,
      align: "right",
    });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(muted)
      .text(inv.numero, left, 74, { width, align: "right" });
    // Sello de estado: "PAID" en verde para la factura final.
    if (paid) {
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#00875f").text("PAID", left, 88, {
        width,
        align: "right",
      });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor(muted).text(invoiceStatusEn(inv.estado), left, 88, {
        width,
        align: "right",
      });
    }

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
    const methodLabel = paymentMethodEn(inv.metodoPago);
    if (methodLabel) dateRow("Payment method", methodLabel);

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

    // --- Instrucciones de pago (solo si queda algo por cobrar) ---
    if (inv.estado === "pendiente") {
      const rows = bankRows({ amountLabel: invoiceMoney(inv.total), reference: inv.numero });
      // Alto aproximado del recuadro, para decidir si cabe o toca página nueva.
      const estimated = 34 + rows.length * 14 + 30;
      const bottomLimit = doc.page.height - doc.page.margins.bottom - 44;
      if (ty + estimated > bottomLimit) {
        doc.addPage();
        ty = doc.page.margins.top;
      }

      ty += 18;
      const boxTop = ty;
      const padX = left + 14;
      const labelW = 92;
      const valueX = padX + labelW + 8;
      const valueW = right - 14 - valueX;

      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(faint)
        .text("HOW TO PAY — BANK TRANSFER", padX, boxTop + 12);

      let py = doc.y + 7;
      for (const row of rows) {
        // La referencia va resaltada: es el único dato que liga el ingreso al pedido.
        const strong = row.key === "reference";
        doc.font("Helvetica").fontSize(8).fillColor(muted);
        doc.text(BANK_LABEL_EN[row.key], padX, py + 1, { width: labelW });
        doc
          .font(strong ? "Helvetica-Bold" : "Helvetica")
          .fontSize(strong ? 10 : 9)
          .fillColor(ink)
          .text(row.value, valueX, py, { width: valueW });
        py = Math.max(doc.y, py + 12) + 3;
      }

      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor(muted)
        .text(bankReferenceNoteEn(inv.numero), padX, py + 2, { width: right - 14 - padX });

      const boxBottom = doc.y + 12;
      // El marco se dibuja al final, ya conocida la altura real del contenido.
      doc
        .roundedRect(left, boxTop, width, boxBottom - boxTop, 4)
        .strokeColor("#c9d3e4")
        .lineWidth(1)
        .stroke();
      ty = boxBottom;
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
      ty = doc.y; // para que lo que siga no se pinte encima de las notas
    }

    // --- Nota de proforma ---
    if (proforma) {
      ty += 12;
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor(faint)
        .text(
          "This is a proforma document, not a final invoice. A final invoice will be issued once payment is confirmed.",
          left,
          ty,
          { width }
        );
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
