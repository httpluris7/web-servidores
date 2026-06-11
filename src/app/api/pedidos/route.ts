import { NextResponse } from "next/server";
import { saveLead, clean, emailRe } from "@/lib/leads";
import { getPlanById } from "@/data/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const planId = clean(body.planId, 60);
  const region = clean(body.region, 60);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Indica tu nombre o empresa.";
  if (!emailRe.test(email)) errors.email = "Introduce un email válido.";

  const located = getPlanById(planId);
  if (!located) errors.planId = "Plan no válido.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  try {
    await saveLead("pedido", {
      name,
      email,
      region,
      planId,
      planName: located!.plan.name,
      price: located!.plan.price,
      line: located!.lineTitle,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo registrar el pedido. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
