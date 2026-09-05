import { NextResponse } from "next/server";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";
import { setVpsNetwork, vpsNetwork } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODELS = new Set(["virtio", "e1000", "e1000e", "vmxnet3"]);
const IP = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]{3,45}$/;

/** Red del servicio: GET lee NIC + DNS + IP asignada; PUT cambia modelo, cortafuegos de la NIC o DNS. */
export async function GET(_req: Request, ctx: Ctx) {
  const g = await panelGuard(ctx, "panel-red", 60);
  if (g.error) return g.error;
  try {
    const r = await vpsNetwork(g.ficha!.remoteId);
    return NextResponse.json({ ok: true, nic: r.nic, nameserver: r.nameserver, ipconfig: r.ipconfig, models: r.models });
  } catch (err) {
    return falloProvisioner("red", err);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const g = await panelGuard(ctx, "panel-red", 20);
  if (g.error) return g.error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const input: { model?: string; firewall?: boolean; nameserver?: string[] } = {};
  if (typeof body.model === "string" && MODELS.has(body.model)) input.model = body.model;
  if (typeof body.firewall === "boolean") input.firewall = body.firewall;
  if (Array.isArray(body.nameserver)) {
    const ns = body.nameserver.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
    if (ns.length < 1 || ns.length > 3 || !ns.every((x) => IP.test(x))) {
      return NextResponse.json({ ok: false, error: "invalid_dns" }, { status: 422 });
    }
    input.nameserver = ns;
  }
  if (Object.keys(input).length === 0) return NextResponse.json({ ok: false, error: "unsupported" }, { status: 422 });
  try {
    const r = await setVpsNetwork(g.ficha!.remoteId, input);
    return NextResponse.json({ ok: true, requiereReinicio: r.requiere_reinicio });
  } catch (err) {
    return falloProvisioner("red", err);
  }
}

type Ctx = { params: Promise<{ id: string }> };
