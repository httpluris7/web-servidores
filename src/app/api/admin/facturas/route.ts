import { NextResponse } from "next/server";
import { clean, emailRe } from "@/lib/leads";
import { getAdminSession } from "@/lib/admin";
import { createInvoice, listInvoices, PAYMENT_METHODS, type PaymentMethod } from "@/lib/facturas";
import { emailInvoiceDocument } from "@/lib/invoice-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista todas las facturas (solo admin). */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, facturas: await listInvoices() });
}

/** Crea una factura nueva (solo admin). */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const clienteNombre = clean(body.clienteNombre, 160);
  const clienteEmail = clean(body.clienteEmail, 200);
  const notas = clean(body.notas, 2000);
  const userId = clean(body.userId, 80) || null;
  const ivaPct = body.ivaPct === undefined || body.ivaPct === "" ? 0 : Number(body.ivaPct);
  const vencimientoDias =
    body.vencimientoDias === undefined || body.vencimientoDias === ""
      ? 30
      : Number(body.vencimientoDias);
  const metodoRaw = clean(body.metodoPago, 20);
  const metodoPago = (PAYMENT_METHODS as string[]).includes(metodoRaw)
    ? (metodoRaw as PaymentMethod)
    : null;

  // Líneas de producto: normalizamos cada una a su forma tipada.
  const rawLineas = Array.isArray(body.lineas) ? body.lineas : [];
  const lineas = rawLineas.slice(0, 50).map((l) => {
    const line = (l ?? {}) as Record<string, unknown>;
    return {
      concepto: clean(line.concepto, 200),
      descripcion: clean(line.descripcion, 500),
      cantidad: Number(line.cantidad),
      precioUnitario: Number(line.precioUnitario),
      productId: clean(line.productId, 80) || null,
    };
  });

  const errors: Record<string, string> = {};
  if (clienteNombre.length < 2) errors.clienteNombre = "Enter the customer's name.";
  if (!emailRe.test(clienteEmail)) errors.clienteEmail = "Invalid customer email.";
  if (lineas.length === 0) {
    errors.lineas = "Add at least one line item.";
  } else if (
    lineas.some(
      (l) =>
        l.concepto.length < 2 ||
        !Number.isFinite(l.cantidad) ||
        l.cantidad <= 0 ||
        !Number.isFinite(l.precioUnitario) ||
        l.precioUnitario < 0
    )
  ) {
    errors.lineas = "Each line needs a concept, a quantity and a valid price.";
  }
  if (!Number.isFinite(ivaPct) || ivaPct < 0 || ivaPct > 100) errors.ivaPct = "Invalid VAT.";
  if (!Number.isFinite(vencimientoDias) || vencimientoDias < 0)
    errors.vencimientoDias = "Invalid due date.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  try {
    const factura = await createInvoice({
      userId,
      clienteNombre,
      clienteEmail,
      lineas,
      ivaPct,
      vencimientoDias,
      notas,
      metodoPago,
    });

    // Envía la PROFORMA al cliente con el PDF adjunto. Best-effort: si el correo
    // falla, la proforma ya está creada; devolvemos emailSent=false para avisar.
    let emailSent = false;
    try {
      await emailInvoiceDocument(factura);
      emailSent = true;
    } catch (err) {
      console.error(`No se pudo enviar la proforma ${factura.numero} por email:`, err);
    }

    return NextResponse.json({ ok: true, factura, emailSent });
  } catch {
    return NextResponse.json(
      { ok: false, error: "The invoice could not be created. Please try again." },
      { status: 500 }
    );
  }
}
