import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { deleteInvoice, setInvoiceStatus, type InvoiceStatus } from "@/lib/facturas";
import { emailInvoiceDocument } from "@/lib/invoice-notify";
import { aprovisionarFacturaPagada } from "@/lib/provisioner/aprovisionar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESTADOS: InvoiceStatus[] = ["pendiente", "pagada", "cancelada"];

/** Cambia el estado de una factura (solo admin). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const estado = body.estado as InvoiceStatus;
  if (!ESTADOS.includes(estado)) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 422 });
  }

  const result = await setInvoiceStatus(id, estado);
  if (!result) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }

  // Al confirmarse el pago por primera vez, emite y envía la FACTURA FINAL
  // (ya con número fiscal y sello PAID). Best-effort.
  let emailSent: boolean | undefined;
  if (result.justPaid) {
    emailSent = false;
    try {
      await emailInvoiceDocument(result.invoice);
      emailSent = true;
    } catch (err) {
      console.error(`No se pudo enviar la factura ${result.invoice.numero} por email:`, err);
    }
    // Pago por transferencia confirmado a mano: dispara el aprovisionamiento
    // igual que el webhook de tarjeta. Best-effort (no lanza).
    await aprovisionarFacturaPagada(result.invoice.id);
  }

  return NextResponse.json({ ok: true, factura: result.invoice, emailSent });
}

/** Elimina una factura (solo admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  const { id } = await params;
  const removed = await deleteInvoice(id);
  if (!removed) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
