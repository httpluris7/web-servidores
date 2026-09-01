import { esProforma, transferRef, type Invoice } from "@/lib/facturas";
import { sendInvoiceMail } from "@/lib/mail";
import {
  generateInvoicePdf,
  invoiceMoney,
  invoiceDateEn,
  invoiceStatusEn,
} from "@/lib/invoice-pdf";

/**
 * Genera el PDF de la factura (proforma o final, según su estado) y lo envía al
 * cliente por email. Lanza si algo falla, para que quien llama lo trate como
 * best-effort (la factura ya está persistida).
 */
export async function emailInvoiceDocument(inv: Invoice): Promise<void> {
  const pdf = await generateInvoicePdf(inv);
  await sendInvoiceMail({
    to: inv.clienteEmail,
    clientName: inv.clienteNombre,
    numero: inv.numero,
    bankReference: transferRef(inv),
    amountLabel: invoiceMoney(inv.total),
    dueDate: invoiceDateEn(inv.vencimientoAt),
    status: invoiceStatusEn(inv.estado),
    isProforma: esProforma(inv),
    // Si hay enlace de pago con tarjeta, va en el correo junto a los datos de
    // la transferencia: que el cliente elija cómo paga.
    payUrl: inv.estado === "pendiente" ? (inv.pago?.url ?? null) : null,
    pdf,
  });
}
