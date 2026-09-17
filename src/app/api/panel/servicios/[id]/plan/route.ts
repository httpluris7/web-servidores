import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";
import { getVpsDetalle, ProvisionerError, setVpsPlan } from "@/lib/provisioner/client";
import { discoGbDeTexto } from "@/lib/provisioner/os";
import { getCatalog, vpsPlansForRegion, type Plan } from "@/data/products";
import { createInvoice } from "@/lib/facturas";
import { emailInvoiceDocument } from "@/lib/invoice-notify";
import { getPublicUserById } from "@/lib/auth";
import { cambioPendienteDeFicha, registrarCambioPlan } from "@/lib/provisioner/cambios-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ampliar / reducir plan del servidor.
 *
 * GET: plan actual, opciones de la región (con precio y specs), si se puede
 * (el disco nunca se reduce) y si hay una ampliación pendiente de pago.
 * POST {plan}: AMPLIAR emite una proforma por la diferencia de precio mensual y
 * deja registrado el cambio para aplicarlo al cobrarse; REDUCIR se aplica al
 * instante sin cobro (nuevo precio desde el siguiente cobro). El disco nunca
 * se reduce: al bajar a un plan con menos disco se conserva el actual.
 */
type Opcion = {
  slug: string;
  nombre: string;
  precio: number;
  cpu: string;
  ram: string;
  storage: string;
  discoGb: number | null;
  tipo: "actual" | "upgrade" | "downgrade";
  permitido: boolean;
  /** `disk_kept`: el plan tiene menos disco que el actual; se conserva el disco (nunca se reduce). */
  motivo: "disk_kept" | null;
};

async function opcionesPara(remoteId: number, locale: string) {
  const d = await getVpsDetalle(remoteId);
  const catalog = await getCatalog(locale);
  const region = catalog.regions.find((r) => r.provisionLocation === d.location_slug);
  // Un AI Developer VPS cambia de plan DENTRO de su familia (misma imagen y
  // región); el resto, dentro de la gama Cloud VPS de su región.
  const esAi = !!catalog.aiVps?.plans.some((p) => p.id === d.plan_slug);
  const planes: Plan[] = esAi
    ? (catalog.aiVps?.plans ?? [])
    : region
      ? vpsPlansForRegion(catalog, region.slug)
      : catalog.vps.plans;
  const actual = planes.find((p) => p.id === d.plan_slug) ?? null;
  const precioActual = actual?.price ?? (d.precio_mes_eur != null ? d.precio_mes_eur / 100 : 0);
  const discoActual = d.disco_gb;
  const opciones: Opcion[] = planes.map((p) => {
    const discoGb = discoGbDeTexto(p.storage);
    const esActual = p.id === d.plan_slug;
    const tipo: Opcion["tipo"] = esActual ? "actual" : p.price > precioActual ? "upgrade" : "downgrade";
    const encoge = discoGb != null && discoActual != null && discoGb < discoActual;
    return {
      slug: p.id,
      nombre: p.name,
      precio: p.price,
      cpu: p.cpu,
      ram: p.ram,
      storage: p.storage,
      discoGb,
      tipo,
      permitido: !esActual,
      motivo: encoge ? "disk_kept" : null,
    };
  });
  return { d, actual, precioActual, opciones };
}

export async function GET(_req: Request, ctx: Ctx) {
  const g = await panelGuard(ctx, "panel-plan", 60);
  if (g.error) return g.error;
  try {
    const locale = await getLocale();
    const { d, actual, precioActual, opciones } = await opcionesPara(g.ficha!.remoteId, locale);
    const pendiente = await cambioPendienteDeFicha(g.ficha!.id);
    return NextResponse.json({
      ok: true,
      actual: { slug: d.plan_slug, nombre: actual?.name ?? d.plan_slug, precio: precioActual, cpu: actual?.cpu ?? null, ram: actual?.ram ?? null, storage: actual?.storage ?? null },
      opciones,
      pendiente: pendiente ? { invoiceId: pendiente.invoiceId, aPlan: pendiente.aPlan, importe: pendiente.importe } : null,
    });
  } catch (err) {
    return falloProvisioner("plan", err);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await panelGuard(ctx, "panel-plan-cambio", 6);
  if (g.error) return g.error;
  const ficha = g.ficha!;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const slug = typeof body.plan === "string" ? body.plan : "";
  if (!slug) return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 422 });
  try {
    const locale = await getLocale();
    const { d, actual, precioActual, opciones } = await opcionesPara(ficha.remoteId, locale);
    const elegido = opciones.find((o) => o.slug === slug);
    if (!elegido || !elegido.permitido) return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 422 });
    if (await cambioPendienteDeFicha(ficha.id)) return NextResponse.json({ ok: false, error: "pending" }, { status: 409 });
    if (!ficha.userId) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

    if (elegido.tipo === "downgrade") {
      const r = await setVpsPlan(ficha.remoteId, slug, true);
      await registrarCambioPlan({ servidorId: ficha.id, remoteId: ficha.remoteId, userId: ficha.userId, dePlan: d.plan_slug ?? "", aPlan: slug, importe: 0, invoiceId: null, estado: "aplicado" });
      return NextResponse.json({ ok: true, aplicado: true, requiereReinicio: r.requiere_reinicio });
    }

    // Ampliación: proforma por la diferencia de precio mensual.
    const user = await getPublicUserById(ficha.userId);
    if (!user) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    const importe = Math.round((elegido.precio - precioActual) * 100) / 100;
    const nombreServidor = d.hostname || ficha.etiqueta || `vps-${d.vmid}`;
    const inv = await createInvoice({
      userId: ficha.userId,
      clienteEmail: user.email,
      clienteNombre: [user.nombre, user.apellidos].filter(Boolean).join(" ") || user.email,
      lineas: [
        {
          concepto: `Plan upgrade: ${actual?.name ?? d.plan_slug} → ${elegido.nombre}`,
          descripcion: `Server ${nombreServidor} · monthly price difference (${precioActual.toFixed(2)} € → ${elegido.precio.toFixed(2)} €)`,
          cantidad: 1,
          precioUnitario: importe,
          productId: `plan-change:${elegido.slug}`,
        },
      ],
      metodoPago: "transferencia",
      notas: `Cambio de plan del servidor ${ficha.id}`,
    });
    await registrarCambioPlan({ servidorId: ficha.id, remoteId: ficha.remoteId, userId: ficha.userId, dePlan: d.plan_slug ?? "", aPlan: slug, importe, invoiceId: inv.id });
    try {
      await emailInvoiceDocument(inv);
    } catch (err) {
      console.error("[plan] no se pudo enviar la proforma de ampliación:", inv.numero, err);
    }
    return NextResponse.json({ ok: true, aplicado: false, invoiceId: inv.id, numero: inv.numero, importe });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    if (status === 409) return NextResponse.json({ ok: false, error: "busy" }, { status: 409 });
    if (status === 422) return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 422 });
    return falloProvisioner("plan", err);
  }
}

type Ctx = { params: Promise<{ id: string }> };
