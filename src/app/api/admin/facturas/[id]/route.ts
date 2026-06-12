import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { deleteInvoice, setInvoiceStatus, type InvoiceStatus } from "@/lib/facturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESTADOS: InvoiceStatus[] = ["pendiente", "pagada", "cancelada"];

/** Cambia el estado de una factura (solo admin). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const estado = body.estado as InvoiceStatus;
  if (!ESTADOS.includes(estado)) {
    return NextResponse.json({ ok: false, error: "Estado no válido." }, { status: 422 });
  }

  const factura = await setInvoiceStatus(id, estado);
  if (!factura) {
    return NextResponse.json({ ok: false, error: "Factura no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, factura });
}

/** Elimina una factura (solo admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const removed = await deleteInvoice(id);
  if (!removed) {
    return NextResponse.json({ ok: false, error: "Factura no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
