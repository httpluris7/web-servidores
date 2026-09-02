import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { njallaHasCreds, readSettings } from "@/lib/ajustes";
import { findDomains, NjallaError } from "@/lib/domains/njalla";
import { precioDominioEur } from "@/lib/domains/precio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** TLDs que se muestran primero (el resto, alfabético). */
const POPULARES = [
  "com", "net", "org", "es", "io", "co", "dev", "app", "ai", "me",
  "online", "shop", "xyz", "info", "eu", "tech", "site", "store", "cloud",
];

/**
 * Búsqueda de dominios (público). Llama a Njalla `find-domains`, aplica el margen
 * y devuelve SOLO el precio al cliente (nunca el coste de Njalla). Sin login: la
 * búsqueda es previa al carrito. Rate-limit por IP.
 */
export async function GET(req: Request) {
  const rl = rateLimit(`dominios-buscar:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { njalla } = await readSettings();
  if (!njallaHasCreds(njalla)) {
    return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  }

  const crudo = new URL(req.url).searchParams.get("q") ?? "";
  // Nos quedamos con la etiqueta (antes del primer / o .) y la saneamos: así la
  // búsqueda devuelve la rejilla de TLDs, sin importar si escribió un TLD.
  let label = crudo.trim().toLowerCase();
  const corte = label.search(/[/.]/);
  if (corte >= 0) label = label.slice(0, corte);
  label = label.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 63);
  if (!label) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  try {
    const ofertas = await findDomains(label);
    const orden = new Map(POPULARES.map((t, i) => [t, i]));
    const resultados = ofertas
      .map((o) => {
        const tld = o.name.includes(".") ? o.name.slice(o.name.indexOf(".") + 1) : "";
        const disponible = o.status.toLowerCase() === "available";
        return {
          name: o.name,
          tld,
          disponible,
          // Precio al cliente solo si está disponible y Njalla dio precio.
          precioEur: disponible && o.price != null ? precioDominioEur(o.price, njalla.margenPct) : null,
        };
      })
      .filter((r) => r.tld)
      .sort((a, b) => {
        const pa = orden.has(a.tld) ? orden.get(a.tld)! : 999;
        const pb = orden.has(b.tld) ? orden.get(b.tld)! : 999;
        return pa !== pb ? pa - pb : a.tld.localeCompare(b.tld);
      })
      .slice(0, 40);

    return NextResponse.json({ ok: true, label, resultados });
  } catch (err) {
    const reason = err instanceof NjallaError ? err.reason : "api";
    console.error("[dominios] fallo en find-domains", reason, err);
    return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
  }
}
