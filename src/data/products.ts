/**
 * Catálogo de productos ViaHost (sin CMS — fuente única tipada).
 * Precios y specs son datos de demostración realistas marcados con `TODO:`.
 * Edita aquí para cambiar planes, precios o regiones.
 */

import { deployUrl } from "./site";

export type Region = {
  slug: string;
  name: string;
  flag: string; // emoji bandera (placeholder visual; sustituible por SVG propio)
  city: string;
  priceFrom: number; // €/mes desde
  latencyNote?: string;
  // Coordenadas relativas (0–100) sobre el SVG del mapa de Europa.
  map: { x: number; y: number };
};

export type Plan = {
  id: string;
  name: string;
  cpu: string;
  ram: string;
  storage: string;
  bandwidth: string;
  price: number; // €/mes
  orderUrl: string;
  popular?: boolean;
};

export type ProductLine = {
  slug: string;
  title: string;
  tagline: string;
  regions?: Region[];
  plans: Plan[];
};

/* -------------------------------------------------------------------------- */
/*  Regiones VPS                                                              */
/*  TODO: confirmar regiones disponibles y precio "desde" reales del cliente. */
/* -------------------------------------------------------------------------- */
export const regions: Region[] = [
  {
    slug: "francia",
    name: "Francia",
    flag: "🇫🇷",
    city: "París",
    priceFrom: 8,
    latencyNote: "< 5 ms a Europa Occidental",
    map: { x: 42, y: 54 },
  },
  {
    slug: "alemania",
    name: "Alemania",
    flag: "🇩🇪",
    city: "Fráncfort",
    priceFrom: 5,
    latencyNote: "Nodo central DE-CIX",
    map: { x: 58, y: 46 },
  },
];

/* -------------------------------------------------------------------------- */
/*  Línea VPS                                                                  */
/* -------------------------------------------------------------------------- */
export const vps: ProductLine = {
  slug: "vps",
  title: "Cloud VPS",
  tagline: "Máquinas virtuales NVMe con red de 10 Gbps y protección DDoS incluida.",
  regions,
  plans: [
    {
      id: "vps-start",
      name: "VPS Start",
      cpu: "2 vCore AMD EPYC",
      ram: "4 GB DDR5",
      storage: "60 GB NVMe Gen4",
      bandwidth: "10 Gbps · tráfico ilimitado",
      price: 8,
      orderUrl: deployUrl("/order/vps-start"),
    },
    {
      id: "vps-pro",
      name: "VPS Pro",
      cpu: "4 vCore AMD EPYC",
      ram: "8 GB DDR5",
      storage: "120 GB NVMe Gen4",
      bandwidth: "10 Gbps · tráfico ilimitado",
      price: 14,
      orderUrl: deployUrl("/order/vps-pro"),
      popular: true,
    },
    {
      id: "vps-max",
      name: "VPS Max",
      cpu: "8 vCore AMD EPYC",
      ram: "16 GB DDR5",
      storage: "240 GB NVMe Gen4",
      bandwidth: "10 Gbps · tráfico ilimitado",
      price: 30,
      orderUrl: deployUrl("/order/vps-max"),
    },
    {
      id: "vps-scale",
      name: "VPS Scale",
      cpu: "16 vCore AMD EPYC",
      ram: "32 GB DDR5",
      storage: "480 GB NVMe Gen4",
      bandwidth: "10 Gbps · tráfico ilimitado",
      price: 42,
      orderUrl: deployUrl("/order/vps-scale"),
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Servidores dedicados                                                       */
/*  TODO: confirmar planes dedicados, hardware y precios reales.               */
/* -------------------------------------------------------------------------- */
export type DedicatedType = {
  slug: string;
  title: string;
  tagline: string;
  highlight: string; // etiqueta corta mono
  plans: Plan[];
};

/**
 * Catálogo de planes dedicados (bare metal), compartido entre países.
 * El mismo hardware se ofrece en cada ubicación; el `id` se prefija por país
 * para que cada combinación país+plan tenga una URL de contratación única.
 */
const dedicatedBasePlans: Omit<Plan, "id" | "orderUrl">[] = [
  {
    name: "Ryzen 7950X",
    cpu: "AMD Ryzen 9 7950X · 16C/32T",
    ram: "64 GB DDR5 ECC",
    storage: "2 × 1 TB NVMe Gen4",
    bandwidth: "1 Gbps garantizado",
    price: 89,
    popular: true,
  },
  {
    name: "EPYC 7443",
    cpu: "AMD EPYC 7443 · 24C/48T",
    ram: "128 GB DDR4 ECC",
    storage: "2 × 1.92 TB NVMe Gen4",
    bandwidth: "1 Gbps garantizado",
    price: 159,
  },
  {
    name: "EPYC 9354",
    cpu: "AMD EPYC 9354 · 32C/64T",
    ram: "256 GB DDR5 ECC",
    storage: "4 × 3.84 TB NVMe Gen4",
    bandwidth: "10 Gbps dedicado",
    price: 349,
  },
  {
    name: "Dual EPYC 9454",
    cpu: "2 × AMD EPYC 9454 · 96C/192T",
    ram: "512 GB DDR5 ECC",
    storage: "6 × 3.84 TB NVMe Gen4",
    bandwidth: "10 Gbps dedicado",
    price: 699,
  },
  {
    name: "Storage 360",
    cpu: "AMD EPYC 7443 · 24C/48T",
    ram: "128 GB DDR4 ECC",
    storage: "18 × 20 TB HDD + 2 TB NVMe caché",
    bandwidth: "2 Gbps garantizado",
    price: 549,
  },
];

/** Genera los planes dedicados de un país a partir del catálogo base. */
function dedicatedPlansFor(prefix: string): Plan[] {
  return dedicatedBasePlans.map((p) => {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const id = `ded-${prefix}-${slug}`;
    return { ...p, id, orderUrl: deployUrl(`/order/${id}`) };
  });
}

export const dedicatedTypes: DedicatedType[] = [
  {
    slug: "francia",
    title: "Dedicados Francia",
    tagline: "Bare metal AMD EPYC y Ryzen en nuestro datacenter de París. Uplinks garantizados y NVMe Gen4, sin overselling.",
    highlight: "🇫🇷 París · bare metal",
    plans: dedicatedPlansFor("fr"),
  },
  {
    slug: "holanda",
    title: "Dedicados Holanda",
    tagline: "Bare metal AMD EPYC y Ryzen en Ámsterdam con peering directo en AMS-IX. Uplinks garantizados y NVMe Gen4, sin overselling.",
    highlight: "🇳🇱 Ámsterdam · bare metal",
    plans: dedicatedPlansFor("nl"),
  },
];

/** Todos los productos para el mega-menú y sitemap. */
export const allProductSlugs = {
  vpsRegions: regions.map((r) => r.slug),
  dedicatedTypes: dedicatedTypes.map((d) => d.slug),
};

export function getRegion(slug: string): Region | undefined {
  return regions.find((r) => r.slug === slug);
}

export function getDedicatedType(slug: string): DedicatedType | undefined {
  return dedicatedTypes.find((d) => d.slug === slug);
}

/** Plan localizado junto a la línea de producto a la que pertenece. */
export type LocatedPlan = { plan: Plan; lineSlug: string; lineTitle: string };

/** Todos los planes (VPS + dedicados) aplanados, con su línea de producto. */
export const allPlans: LocatedPlan[] = [
  ...vps.plans.map((plan) => ({ plan, lineSlug: vps.slug, lineTitle: vps.title })),
  ...dedicatedTypes.flatMap((d) =>
    d.plans.map((plan) => ({ plan, lineSlug: d.slug, lineTitle: d.title }))
  ),
];

export function getPlanById(id: string): LocatedPlan | undefined {
  return allPlans.find((p) => p.plan.id === id);
}
