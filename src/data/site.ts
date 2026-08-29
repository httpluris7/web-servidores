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
    "VPS hosting, dedicated servers and DDoS mitigation on European infrastructure. 60-second provisioning, NVMe Gen4 and 10 Gbps uplinks.",
  locale: "en",
  accent: "#00E5A0",

  // Páginas internas funcionales (la web no depende de dominios externos).
  supportUrl: "/soporte",
  statusUrl: "/estado",
  // Subdominio del panel. Hoy no es una aplicación aparte: nginx lo redirige al
  // área de cliente de esta misma web (`/cuenta`), y el cobro se cierra por
  // transferencia (ver `bank`), así que ninguna pantalla necesita enlazarlo.
  billingUrl: "https://panel.viahost.top",

  // UTM aplicado a los CTAs salientes hacia el panel.
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
    companyName: "ViaHost Networks, LLC", // razón social real de la LLC
    jurisdiction: "Wyoming, USA", // estado de constitución de la LLC
    taxId: "EIN 32-0862114", // EIN real (registro fiscal de la LLC)
    address: "7345 W Sand Lake Rd, Ste 210, Office 3344, Orlando, FL 32819, USA", // dirección de oficina
    addressCountry: "US", // código ISO del país de la sede legal
    trustpilotUrl: "", // TODO: URL de Trustpilot si existe (vacío = no se muestra el badge)
  },

  // Cuenta bancaria para el cobro por transferencia. Es el método de pago ACTIVO:
  // se imprime en cada proforma y el cliente debe indicar el número de proforma
  // como concepto para que podamos identificar su pedido (ver `lib/bank.ts`).
  bank: {
    beneficiary: "ViaHost Networks, LLC",
    iban: "BE88905914752241",
    bic: "TRWIBEB1XXX",
    bankName: "Wise",
    bankAddress: "Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium",
  },

  // Métodos de pago mostrados en el footer (texto estilizado, sin logos con licencia).
  paymentMethods: ["Bank transfer", "SEPA", "Visa", "Mastercard", "PayPal", "Crypto"], // TODO: confirmar

  // Mitigación DDoS. Sin cifras inventadas (capacidad Tbps, ataques absorbidos):
  // solo el dato veraz y conceptual: al servidor no llega ningún paquete de ataque.
  ddos: {
    filteredToServer: 0, // paquetes de ataque que llegan al servidor: siempre 0
  },
} as const;

export type Site = typeof site;

/**
 * Ruta interna para iniciar un despliegue/contratación.
 * - `deployUrl()` → selector de producto `/desplegar`.
 * - `deployUrl("/order/<id>")` → checkout interno del plan `/contratar/<id>`.
 * Tras confirmar el pedido, el pago se cierra por transferencia con la proforma.
 */
export function deployUrl(path = ""): string {
  if (!path) return "/desplegar";
  return path.replace("/order/", "/contratar/");
}
