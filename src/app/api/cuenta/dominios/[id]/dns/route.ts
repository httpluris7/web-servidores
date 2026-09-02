import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { usuarioTieneDominio } from "@/lib/domains/intents";
import { addRecord, editRecord, listRecords, NjallaError, removeRecord } from "@/lib/domains/njalla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = new Set(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"]);
const DOMINIO_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9.-]{2,}$/;

/**
 * Editor de DNS del dominio del cliente (CP4). El parámetro de ruta `[id]` es el
 * nombre del dominio. La PROPIEDAD se comprueba con `usuarioTieneDominio` — el
 * único punto, como `getManagedForUser` con los VPS: un dominio ajeno responde
 * 404. GET lista; POST crea; PUT edita; DELETE borra (por id de registro).
 */
async function guard(ctx: { params: Promise<{ id: string }> }, key: string, limit: number) {
  const session = await getSession();
  if (!session) return { domain: null, error: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }) };
  const { id } = await ctx.params;
  const domain = decodeURIComponent(id).toLowerCase();
  if (!DOMINIO_RE.test(domain)) {
    return { domain: null, error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  }
  const rl = rateLimit(`dns:${session.uid}:${domain}:${key}`, { limit, windowMs: 60_000 });
  if (!rl.ok) {
    return { domain: null, error: NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }) };
  }
  if (!(await usuarioTieneDominio(session.uid, domain))) {
    return { domain: null, error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  }
  return { domain, error: null as NextResponse | null };
}

function fallo(err: unknown): NextResponse {
  console.error("[dns] fallo", err instanceof NjallaError ? `${err.reason} ${err.message}` : err);
  return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx, "list", 60);
  if (g.error) return g.error;
  try {
    return NextResponse.json({ ok: true, records: await listRecords(g.domain!) });
  } catch (err) {
    return fallo(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx, "add", 30);
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  const rec = validarRegistro(body);
  if (!rec) return NextResponse.json({ ok: false, error: "invalid" }, { status: 422 });
  try {
    const r = await addRecord(g.domain!, rec);
    return NextResponse.json({ ok: true, id: r.id });
  } catch (err) {
    return fallo(err);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx, "edit", 30);
  if (g.error) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "invalid" }, { status: 422 });
  const rec = validarRegistro(body);
  if (!rec) return NextResponse.json({ ok: false, error: "invalid" }, { status: 422 });
  try {
    await editRecord(g.domain!, { id, ...rec });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fallo(err);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx, "del", 30);
  if (g.error) return g.error;
  const recordId = new URL(req.url).searchParams.get("record") ?? "";
  if (!recordId) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  try {
    await removeRecord(g.domain!, recordId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fallo(err);
  }
}

/** Valida y normaliza un registro de entrada (POST/PUT). */
function validarRegistro(
  body: unknown,
): { type: string; name: string; content: string; ttl?: number; prio?: number } | null {
  const o = (body ?? {}) as Record<string, unknown>;
  const type = String(o.type ?? "").toUpperCase();
  if (!TIPOS.has(type)) return null;
  const name = String(o.name ?? "").trim().slice(0, 100);
  const content = String(o.content ?? "").trim().slice(0, 512);
  if (!content) return null;
  const ttl = Number(o.ttl);
  const prio = Number(o.prio);
  const rec: { type: string; name: string; content: string; ttl?: number; prio?: number } = {
    type,
    // Njalla quiere "@" para la raíz (una cadena vacía la rechaza).
    name: name === "" ? "@" : name,
    content,
  };
  if (Number.isFinite(ttl) && ttl >= 60) rec.ttl = Math.floor(ttl);
  if ((type === "MX" || type === "SRV") && Number.isFinite(prio) && prio >= 0) rec.prio = Math.floor(prio);
  return rec;
}
