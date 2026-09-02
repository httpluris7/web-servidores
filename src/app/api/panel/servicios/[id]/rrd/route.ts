import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { ProvisionerError, vpsRrd, type RrdTimeframe } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEFRAMES: RrdTimeframe[] = ["hour", "day", "week", "month"];

/** Series RRD de Proxmox para las gráficas del panel (fallback sin agente). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!esIdInterno(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const limite = rateLimit(`panel-rrd:${session.uid}:${id}`, { limit: 40, windowMs: 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
    );
  }

  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha || ficha.proveedor !== "proxmox") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const pedido = new URL(req.url).searchParams.get("timeframe");
  const timeframe = TIMEFRAMES.includes(pedido as RrdTimeframe) ? (pedido as RrdTimeframe) : "hour";

  try {
    const r = await vpsRrd(ficha.remoteId, timeframe);
    return NextResponse.json({ ok: true, timeframe: r.timeframe, points: r.points });
  } catch (err) {
    console.error(
      "[panel] fallo leyendo RRD",
      id,
      err instanceof ProvisionerError ? `${err.status ?? ""} ${err.message}` : err,
    );
    return NextResponse.json(
      { ok: false, error: "Could not reach the provisioner." },
      { status: 502 },
    );
  }
}
