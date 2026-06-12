import { NextResponse } from "next/server";
import { clean, emailRe } from "@/lib/leads";
import { getAdminSession } from "@/lib/admin";
import { createInvoice, listInvoices } from "@/lib/facturas";

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
  const concepto = clean(body.concepto, 500);
  const notas = clean(body.notas, 2000);
  const userId = clean(body.userId, 80) || null;
  const base = Number(body.base);
  const ivaPct = body.ivaPct === undefined || body.ivaPct === "" ? 21 : Number(body.ivaPct);
  const vencimientoDias =
    body.vencimientoDias === undefined || body.vencimientoDias === ""
      ? 30
      : Number(body.vencimientoDias);

  const errors: Record<string, string> = {};
  if (clienteNombre.length < 2) errors.clienteNombre = "Enter the customer's name.";
  if (!emailRe.test(clienteEmail)) errors.clienteEmail = "Invalid customer email.";
  if (concepto.length < 3) errors.concepto = "Describe the invoice concept.";
  if (!Number.isFinite(base) || base <= 0) errors.base = "Invalid amount (base).";
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
      concepto,
      base,
      ivaPct,
      vencimientoDias,
      notas,
    });
    return NextResponse.json({ ok: true, factura });
  } catch {
    return NextResponse.json(
      { ok: false, error: "The invoice could not be created. Please try again." },
      { status: 500 }
    );
  }
}
