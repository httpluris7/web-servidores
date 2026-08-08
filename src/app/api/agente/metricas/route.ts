import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  guardarMuestra,
  MAX_CUERPO_BYTES,
  sanearMeta,
  sanearMuestra,
} from "@/lib/servidores/metricas";
import { findByAgentToken } from "@/lib/servidores/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada de métricas del agente instalado en los VPS de los clientes.
 *
 * Es la única ruta pública que escribe en nuestro disco sin sesión, así que
 * está escrita a la defensiva: token por servidor, cuerpo acotado, ritmo
 * limitado por servidor y por IP, y todo valor saneado antes de guardarse. El
 * agente NO puede hacer nada más: no lee datos, no cambia fichas y no sabe a
 * qué cliente pertenece la máquina.
 *
 * La marca de tiempo la pone el servidor, no el agente: un VPS con el reloj
 * descolocado —cosa nada rara— mandaría muestras al futuro y reventaría el eje
 * de todas las gráficas.
 */

/** Sin sesión que gastar, la respuesta de error es siempre igual de escueta. */
function no(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  const ip = clientIp(req);

  // Freno por IP antes de tocar nada: una máquina comprometida no debe poder
  // usar esta ruta como ariete contra el resto del sistema.
  const porIp = rateLimit(`agente-ip:${ip}`, { limit: 120, windowMs: 60_000 });
  if (!porIp.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(porIp.retryAfter) } }
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return no(401, "Missing token.");

  // Cabecera primero: así un cuerpo enorme se rechaza sin llegar a leerlo.
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > MAX_CUERPO_BYTES) {
    return no(413, "Payload too large.");
  }

  const crudo = await req.text();
  if (crudo.length > MAX_CUERPO_BYTES) return no(413, "Payload too large.");

  const ficha = await findByAgentToken(token);
  if (!ficha) return no(401, "Invalid token.");

  // Un agente configurado a 30 s cabe de sobra; por encima es que algo se ha
  // desmadrado y no queremos escribir en disco a ese ritmo.
  const porServidor = rateLimit(`agente:${ficha.id}`, { limit: 6, windowMs: 60_000 });
  if (!porServidor.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many samples." },
      { status: 429, headers: { "Retry-After": String(porServidor.retryAfter) } }
    );
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return no(400, "Invalid JSON.");
  }

  const ahora = Math.floor(Date.now() / 1000);
  const muestra = sanearMuestra(cuerpo, ahora);
  if (!muestra) return no(422, "No usable readings in the payload.");

  const meta = sanearMeta((cuerpo as { meta?: unknown }).meta, ip);
  const guardada = await guardarMuestra(ficha.id, muestra, meta);
  if (!guardada) return no(500, "Could not store the sample.");

  // El intervalo lo manda el panel para poder cambiarlo sin tocar las máquinas.
  return NextResponse.json({ ok: true, intervalo: meta.intervalo ?? 60 });
}
