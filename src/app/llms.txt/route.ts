import { site } from "@/data/site";
import { getCatalog } from "@/data/products";
import { precioDesde } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * /llms.txt — resumen citable de ViaHost para buscadores generativos (GEO).
 *
 * Formato ligero (Markdown) según la convención llms.txt: un resumen y enlaces
 * a las páginas clave. Los precios "desde" y las ubicaciones salen del CATÁLOGO
 * (siempre sincronizados). Solo datos verificables; sin cifras inventadas.
 */
export async function GET() {
  const { url } = site;
  const cat = await getCatalog("es");
  const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €/mes`;

  const vpsDesde = cat.vps.plans.length ? eur(precioDesde(cat.vps.plans)) : null;
  const hostingDesde = cat.hosting && cat.hosting.plans.length ? eur(precioDesde(cat.hosting.plans)) : null;
  const regiones = cat.regions.map((r) => `${r.city} (${r.name})`).join(", ");

  const productos: string[] = [];
  if (vpsDesde)
    productos.push(
      `- **Cloud VPS** (${url}/vps): máquinas virtuales con NVMe Gen4, red de 10 Gbps, virtualización Proxmox y protección DDoS incluida. Desde ${vpsDesde}.`,
    );
  if (hostingDesde)
    productos.push(
      `- **Hosting web con cPanel** (${url}/hosting): alojamiento gestionado con cPanel y Softaculous, SSL, copias diarias y migración gratis. Desde ${hostingDesde}.`,
    );
  productos.push(
    `- **Dominios con privacidad** (${url}/dominios): registro de dominios con privacidad WHOIS incluida sin coste.`,
  );
  if (cat.dedicatedTypes.length)
    productos.push(`- **Servidores dedicados** (${url}/dedicados): bare metal en la UE.`);

  const body = `# ViaHost

> ViaHost (${site.domain}) vende VPS, hosting web con cPanel, dominios con privacidad ${cat.dedicatedTypes.length ? "y servidores dedicados " : ""}sobre infraestructura europea. Aprovisionamiento en 60 segundos, NVMe Gen4 y red de 10 Gbps con protección DDoS incluida. Operado por ${site.legal.companyName} (${site.legal.jurisdiction}).

## Productos y precios
${productos.join("\n")}

## Ubicaciones de datacenter
${regiones || "Europa"}.

## Diferenciadores verificables
- Discos NVMe Gen4 y red de 10 Gbps.
- Virtualización Proxmox en los VPS; panel cPanel en el hosting.
- Protección DDoS incluida: al servidor del cliente no llega ningún paquete de ataque.
- Aprovisionamiento automático (VPS y hosting) al confirmar el pago.
- Dominios con privacidad WHOIS incluida sin coste.

## Pagos
Tarjeta (Stripe) y transferencia bancaria / SEPA. El cobro es en euros (EUR).

## Empresa y contacto
- Razón social: ${site.legal.companyName} (${site.legal.jurisdiction}).
- Soporte: ${site.contact.support} · Ventas: ${site.contact.sales}
- Web: ${url}

## Enlaces clave
- ${url}/vps — Cloud VPS y regiones
- ${url}/hosting — Hosting web cPanel
- ${url}/dominios — Registro de dominios con privacidad
- ${url}/proteccion-ddos — Mitigación DDoS
- ${url}/red — Red y peering
- ${url}/soporte — Soporte
- ${url}/contacto — Contacto
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
