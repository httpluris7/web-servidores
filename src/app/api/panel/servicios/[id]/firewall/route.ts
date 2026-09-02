import { NextResponse } from "next/server";
import { setVpsFirewallOptions, vpsFirewall } from "@/lib/provisioner/client";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLICIES = new Set(["ACCEPT", "DROP", "REJECT"]);

/** Cortafuegos del servicio: GET lee opciones + reglas; PUT cambia opciones. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await panelGuard(ctx, "panel-fw", 60);
  if (g.error) return g.error;
  try {
    const r = await vpsFirewall(g.ficha!.remoteId);
    return NextResponse.json({ ok: true, options: r.options, rules: r.rules });
  } catch (err) {
    return falloProvisioner("cortafuegos", err);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await panelGuard(ctx, "panel-fw", 20);
  if (g.error) return g.error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const opts: { enable?: 0 | 1; policy_in?: string; policy_out?: string } = {};
  if (body.enable === 0 || body.enable === 1) opts.enable = body.enable;
  if (typeof body.policy_in === "string" && POLICIES.has(body.policy_in)) opts.policy_in = body.policy_in;
  if (typeof body.policy_out === "string" && POLICIES.has(body.policy_out)) opts.policy_out = body.policy_out;
  if (Object.keys(opts).length === 0) {
    return NextResponse.json({ ok: false, error: "unsupported" }, { status: 422 });
  }
  try {
    await setVpsFirewallOptions(g.ficha!.remoteId, opts);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return falloProvisioner("cortafuegos", err);
  }
}
