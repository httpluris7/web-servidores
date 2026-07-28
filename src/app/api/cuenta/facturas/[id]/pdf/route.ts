import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { esProforma, getInvoiceForUser } from "@/lib/facturas";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga del PDF de una factura propia.
 *
 * Reutiliza el mismo generador que el panel y el correo, así que el cliente se
 * descarga exactamente el documento que se le envió. Mismo control de acceso
 * que el resto del área de cliente: la factura tiene que ser suya.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const inv = await getInvoiceForUser(id, session.uid, session.email);
  if (!inv) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }

  const pdf = await generateInvoicePdf(inv);
  const nombre = `${esProforma(inv) ? "proforma" : "invoice"}-${inv.numero}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` para que el móvil lo abra en el visor en vez de descargarlo a
      // ciegas; el nombre se conserva si el usuario decide guardarlo.
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
