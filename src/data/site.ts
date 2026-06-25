/**
 * ViaHost — configuración global de marca.
 * ----------------------------------------------------------------------------
 * ESTE ES EL ÚNICO SITIO donde tienes que tocar para renombrar la marca o
 * cambiar datos corporativos. Todo lo marcado con `TODO:` son datos reales del
 * cliente que hay que confirmar antes de publicar (ver lista en README.md).
 */

export const site = {
  brand: "ViaHost",
  // Marca inventada y coherente. Sustituye por la real en este único punto.
  domain: "viahost.top",
  url: "https://viahost.top",
  tagline: "European infrastructure deployed in 60 seconds.",
  description:
    "VPS hosting, dedicated servers and DDoS mitigation on our own network across Europe. 60-second provisioning, NVMe Gen4 and 10 Gbps uplinks.",
  locale: "en",
  accent: "#00E5A0",

  // Páginas internas funcionales (la web no depende de dominios externos).
  supportUrl: "/soporte",
  statusUrl: "/estado",
  // Panel de facturación externo: SOLO se usa como destino final tras confirmar
  // el pedido (handoff al pago). El resto del sitio es autónomo.
  billingUrl: "https://panel.viahost.top", // TODO: URL real del panel WHMCS/billing del cliente

  // UTM aplicado a todos los CTAs salientes hacia el panel.
  utm: "?utm_source=web&utm_medium=site&utm_campaign=deploy",

  contact: {
    sales: "ventas@viahost.top", // TODO: email comercial real
    support: "soporte@viahost.top", // TODO: email de soporte real
    abuse: "abuse@viahost.top", // TODO: email de abuse real
  },

  social: {
    x: "https://x.com/viahost", // TODO: handle real
    github: "https://github.com/viahost", // TODO
    linkedin: "https://linkedin.com/company/viahost", // TODO
  },

  // Datos legales del footer. Entidad: Limited Liability Company (LLC).
  legal: {
    companyName: "ViaHost Networks LLC", // razón social real de la LLC
    jurisdiction: "Wyoming, USA", // estado de constitución de la LLC
    taxId: "EIN 33-1234567", // EIN real (registro fiscal de la LLC)
    address: "7345 W Sand Lake Rd, Ste 210, Orlando, FL 32819, USA", // dirección de oficina
    addressCountry: "US", // código ISO del país de la sede legal
    trustpilotUrl: "", // TODO: URL de Trustpilot si existe (vacío = no se muestra el badge)
  },

  // Métodos de pago mostrados en el footer (texto estilizado, sin logos con licencia).
  paymentMethods: ["Visa", "Mastercard", "PayPal", "SEPA", "Bizum", "Crypto"], // TODO: confirmar

  // Red / backbone.
  network: {
    asn: "AS201234", // TODO: ASN real del cliente
    peers: 320, // TODO: nº real de peers
    capacityTbps: 12, // TODO: capacidad total de red en Tbps
    portMaxGbps: 100, // TODO: puerto máximo por servidor (Gbps)
    rankingNote: "Top 50 IXP Europe", // TODO: ranking real si aplica
  },

  // Mitigación DDoS.
  ddos: {
    mitigationTbps: 25, // TODO: capacidad de mitigación real (Tbps)
    absorbedAttacks: "1.2M", // TODO: ataques absorbidos (acumulado)
    filteredToServer: 0, // paquetes de ataque que llegan al servidor: siempre 0
  },
} as const;

export type Site = typeof site;

/**
 * Ruta interna para iniciar un despliegue/contratación.
 * - `deployUrl()` → selector de producto `/desplegar`.
 * - `deployUrl("/order/<id>")` → checkout interno del plan `/contratar/<id>`.
 * El pago real se delega al panel externo (`site.billingUrl`) desde el checkout.
 */
export function deployUrl(path = ""): string {
  if (!path) return "/desplegar";
  return path.replace("/order/", "/contratar/");
}

/** Handoff final al panel de facturación externo con UTM (tras confirmar pedido). */
export function billingHandoffUrl(planId: string): string {
  return `${site.billingUrl}/order/${planId}${site.utm}`;
}
