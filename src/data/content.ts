/**
 * Copy y contenido estructurado de la Home y secciones compartidas.
 * Todo el texto es original (sin copiar de ninguna web existente).
 */

export type Feature = {
  metric: string; // dato grande / etiqueta mono protagonista
  label: string;
  body: string;
};

/** Sección "Por qué nosotros" — el dato es el protagonista, no un icono de stock. */
export const whyUs: Feature[] = [
  {
    metric: "60 s",
    label: "Real deploy",
    body: "From payment to a live server in under a minute. No queues, no manual approval.",
  },
  {
    metric: "25 Tbps",
    label: "DDoS Mitigation",
    body: "Always-on filtering at the network edge. You don't pay extra to stay protected.",
  },
  {
    metric: "Gen4",
    label: "NVMe everywhere",
    body: "Every plan, down to the smallest, boots on NVMe Gen4. Zero spinning disks in compute.",
  },
  {
    metric: "10 Gbps",
    label: "Network per server",
    body: "10 Gbps uplinks with no overselling. The bandwidth you see is the bandwidth you get.",
  },
  {
    metric: "6",
    label: "EU regions",
    body: "Distributed presence across Europe with direct peering at the major IXPs.",
  },
  {
    metric: "24/7",
    label: "Human support",
    body: "Engineering on call around the clock. Average response under 10 minutes on incidents.",
  },
];

export type UseCase = {
  n: string;
  title: string;
  bullets: string[];
  href: string;
};

/** Casos de uso — 4 tarjetas numeradas que enlazan a producto. */
export const useCases: UseCase[] = [
  {
    n: "/01",
    title: "Web applications",
    bullets: [
      "Deploy in 60 s on NVMe Gen4",
      "Scale up without migrating hosts",
      "DDoS included for traffic spikes",
    ],
    href: "/vps",
  },
  {
    n: "/02",
    title: "Databases",
    bullets: [
      "Sustained IOPS on NVMe Gen4",
      "ECC RAM on bare metal",
      "Low-latency private network",
    ],
    href: "/dedicados/francia",
  },
  {
    n: "/03",
    title: "Enterprise",
    bullets: [
      "Dedicated dual EPYC bare metal",
      "10 Gbps with guaranteed port",
      "SLA and priority support",
    ],
    href: "/dedicados/holanda",
  },
  {
    n: "/04",
    title: "SaaS and platforms",
    bullets: [
      "Multi-region for low latency",
      "Provisioning API for autoscaling",
      "Predictable per-server billing",
    ],
    href: "/vps",
  },
];

/** 6 features cortas de seguridad para la sección DDoS. */
export const ddosFeatures: string[] = [
  "Edge detection < 2 s",
  "L3/L4 and L7 filtering",
  "Adaptive per-signature rules",
  "Always-on, no reroute",
  "No per-attack charge",
  "Incident reporting in the panel",
];

/** Líneas de la terminal de provisioning (typing secuencial). */
export const terminalLines: { cmd: string; ok: string }[] = [
  { cmd: "allocating slot", ok: "ok" },
  { cmd: "imaging ubuntu-24.04", ok: "ok" },
  { cmd: "attaching uplink 10G", ok: "ok" },
  { cmd: "applying ddos shield", ok: "ok" },
  { cmd: "server online", ok: "54s" },
];

/** Logos / partners de hardware (texto estilizado, sin SVGs con licencia). */
export const partners: string[] = [
  "AMD EPYC",
  "Ryzen",
  "Samsung NVMe",
  "Kioxia",
  "Supermicro",
  "Arista",
  "Juniper",
  "DE-CIX",
  "AMS-IX",
  "LINX",
];

/** Ciudades para el marquee de relojes en tiempo real del CTA final. */
export const clockCities: { city: string; tz: string }[] = [
  { city: "Madrid", tz: "Europe/Madrid" },
  { city: "Paris", tz: "Europe/Paris" },
  { city: "Amsterdam", tz: "Europe/Amsterdam" },
  { city: "Frankfurt", tz: "Europe/Berlin" },
  { city: "London", tz: "Europe/London" },
  { city: "Warsaw", tz: "Europe/Warsaw" },
];
