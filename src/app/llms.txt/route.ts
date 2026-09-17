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
  if (cat.aiVps && cat.aiVps.plans.length)
    productos.push(
      `- **AI Developer VPS** (${url}/ai-developer-vps): VPS para agentes de programación IA, entregados con Claude Code, OpenAI Codex CLI, Docker, Git, GitHub CLI, Node.js LTS y Python preinstalados sobre Ubuntu 24.04 LTS (usuario \`developer\`, tmux para sesiones 24/7). Solo en Alemania, sobre AMD EPYC 7402P con NVMe. Planes: ${cat.aiVps.plans
        .map((p) => `${p.name} (${p.cpu}, ${p.ram}, ${p.storage}) ${eur(p.price)}`)
        .join("; ")}. Pago mensual, renovación mensual, sin permanencia. Las suscripciones y el consumo de Anthropic y OpenAI NO están incluidos: el cliente usa su propia cuenta o API key. ViaHost no está afiliada con Anthropic ni OpenAI.`,
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
${cat.aiVps && cat.aiVps.plans.length ? `- ${url}/ai-developer-vps — AI Developer VPS (Claude Code + OpenAI Codex preinstalados)
- ${url}/claude-code-vps — VPS para Claude Code 24/7
- ${url}/codex-vps — VPS para OpenAI Codex CLI
` : ""}- ${url}/hosting — Hosting web cPanel
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
