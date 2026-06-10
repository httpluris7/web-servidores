/**
 * Catálogo de productos NODARA (sin CMS — fuente única tipada).
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
    priceFrom: 4,
    latencyNote: "< 5 ms a Europa Occidental",
    map: { x: 44, y: 52 },
  },
  {
    slug: "paises-bajos",
    name: "Países Bajos",
    flag: "🇳🇱",
    city: "Ámsterdam",
    priceFrom: 4,
    latencyNote: "Peering directo en AMS-IX",
    map: { x: 48, y: 42 },
  },
  {
    slug: "alemania",
    name: "Alemania",
    flag: "🇩🇪",
    city: "Fráncfort",
    priceFrom: 5,
    latencyNote: "Nodo central DE-CIX",
    map: { x: 53, y: 46 },
  },
  {
    slug: "espana",
    name: "España",
    flag: "🇪🇸",
    city: "Madrid",
    priceFrom: 5,
    latencyNote: "< 10 ms a la Península",
    map: { x: 34, y: 70 },
  },
  {
    slug: "reino-unido",
    name: "Reino Unido",
    flag: "🇬🇧",
    city: "Londres",
    priceFrom: 6,
    latencyNote: "Peering LINX",
    map: { x: 40, y: 40 },
  },
  {
    slug: "polonia",
    name: "Polonia",
    flag: "🇵🇱",
    city: "Varsovia",
    priceFrom: 5,
    latencyNote: "Cobertura Europa del Este",
    map: { x: 62, y: 42 },
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
      price: 4,
      orderUrl: deployUrl("/order/vps-start"),
    },
    {
      id: "vps-pro",
      name: "VPS Pro",
      cpu: "4 vCore AMD EPYC",
      ram: "8 GB DDR5",
      storage: "120 GB NVMe Gen4",
      bandwidth: "10 Gbps · tráfico ilimitado",
      price: 8,
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
      price: 16,
      orderUrl: deployUrl("/order/vps-max"),
    },
    {
      id: "vps-scale",
      name: "VPS Scale",
      cpu: "16 vCore AMD EPYC",
      ram: "32 GB DDR5",
      storage: "480 GB NVMe Gen4",
      bandwidth: "10 Gbps · tráfico ilimitado",
      price: 32,
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

export const dedicatedTypes: DedicatedType[] = [
  {
    slug: "1gbps",
    title: "Dedicado 1 Gbps",
    tagline: "Bare metal de propósito general con uplink garantizado de 1 Gbps.",
    highlight: "1 Gbps · sin overselling",
    plans: [
      {
        id: "ded-1g-ryzen",
        name: "Ryzen 7950X",
        cpu: "AMD Ryzen 9 7950X · 16C/32T",
        ram: "64 GB DDR5 ECC",
        storage: "2 × 1 TB NVMe Gen4",
        bandwidth: "1 Gbps garantizado",
        price: 89,
        orderUrl: deployUrl("/order/ded-1g-ryzen"),
        popular: true,
      },
      {
        id: "ded-1g-epyc",
        name: "EPYC 7443",
        cpu: "AMD EPYC 7443 · 24C/48T",
        ram: "128 GB DDR4 ECC",
        storage: "2 × 1.92 TB NVMe Gen4",
        bandwidth: "1 Gbps garantizado",
        price: 159,
        orderUrl: deployUrl("/order/ded-1g-epyc"),
      },
    ],
  },
  {
    slug: "10gbps",
    title: "Dedicado 10 Gbps",
    tagline: "Para CDN, streaming y cargas que saturan la red. Uplink de 10 Gbps.",
    highlight: "10 Gbps · puerto dedicado",
    plans: [
      {
        id: "ded-10g-epyc",
        name: "EPYC 9354",
        cpu: "AMD EPYC 9354 · 32C/64T",
        ram: "256 GB DDR5 ECC",
        storage: "4 × 3.84 TB NVMe Gen4",
        bandwidth: "10 Gbps dedicado",
        price: 349,
        orderUrl: deployUrl("/order/ded-10g-epyc"),
        popular: true,
      },
      {
        id: "ded-10g-dual",
        name: "Dual EPYC 9454",
        cpu: "2 × AMD EPYC 9454 · 96C/192T",
        ram: "512 GB DDR5 ECC",
        storage: "6 × 3.84 TB NVMe Gen4",
        bandwidth: "10 Gbps dedicado",
        price: 699,
        orderUrl: deployUrl("/order/ded-10g-dual"),
      },
    ],
  },
  {
    slug: "storage",
    title: "Storage Server",
    tagline: "Capacidad masiva para backup, archivo y data lakes. Coste por TB imbatible.",
    highlight: "Hasta 360 TB · HDD + caché NVMe",
    plans: [
      {
        id: "ded-storage-90",
        name: "Storage 90",
        cpu: "AMD Ryzen 9 7900 · 12C/24T",
        ram: "64 GB DDR5 ECC",
        storage: "6 × 16 TB HDD + 1 TB NVMe caché",
        bandwidth: "1 Gbps garantizado",
        price: 199,
        orderUrl: deployUrl("/order/ded-storage-90"),
      },
      {
        id: "ded-storage-360",
        name: "Storage 360",
        cpu: "AMD EPYC 7443 · 24C/48T",
        ram: "128 GB DDR4 ECC",
        storage: "18 × 20 TB HDD + 2 TB NVMe caché",
        bandwidth: "2 Gbps garantizado",
        price: 549,
        orderUrl: deployUrl("/order/ded-storage-360"),
        popular: true,
      },
    ],
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
