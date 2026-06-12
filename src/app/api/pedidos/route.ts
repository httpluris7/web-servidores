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
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const planId = clean(body.planId, 60);
  const region = clean(body.region, 60);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter your name or company.";
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";

  const located = getPlanById(planId);
  if (!located) errors.planId = "Invalid plan.";

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
      { ok: false, error: "The order could not be saved. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
