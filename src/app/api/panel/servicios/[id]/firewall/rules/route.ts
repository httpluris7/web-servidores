import { NextResponse } from "next/server";
import { addVpsFirewallRule, deleteVpsFirewallRule } from "@/lib/provisioner/client";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECCIONES = new Set(["in", "out"]);
const ACCIONES = new Set(["ACCEPT", "DROP", "REJECT"]);
const PROTOS = new Set(["tcp", "udp", "icmp"]);

/** Crea una regla del cortafuegos del servicio. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await panelGuard(ctx, "panel-fw", 20);
  if (g.error) return g.error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const type = String(body.type ?? "");
  const action = String(body.action ?? "");
  if (!DIRECCIONES.has(type) || !ACCIONES.has(action)) {
    return NextResponse.json({ ok: false, error: "unsupported" }, { status: 422 });
  }
  const rule: { type: string; action: string; proto?: string; dport?: string; source?: string; comment?: string } = {
    type,
    action,
  };
  if (typeof body.proto === "string" && PROTOS.has(body.proto)) rule.proto = body.proto;
  if (typeof body.dport === "string" && /^[0-9:,\-]{1,40}$/.test(body.dport)) rule.dport = body.dport;
  if (typeof body.source === "string" && body.source.trim()) rule.source = body.source.trim().slice(0, 64);
  if (typeof body.comment === "string" && body.comment.trim()) rule.comment = body.comment.trim().slice(0, 120);

  try {
    await addVpsFirewallRule(g.ficha!.remoteId, rule);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return falloProvisioner("cortafuegos", err);
  }
}

/** Borra una regla por su posición (?pos=N). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await panelGuard(ctx, "panel-fw", 20);
  if (g.error) return g.error;
  const pos = Number(new URL(req.url).searchParams.get("pos"));
  if (!Number.isInteger(pos) || pos < 0) {
    return NextResponse.json({ ok: false, error: "Invalid pos." }, { status: 400 });
  }
  try {
    await deleteVpsFirewallRule(g.ficha!.remoteId, pos);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return falloProvisioner("cortafuegos", err);
  }
}
