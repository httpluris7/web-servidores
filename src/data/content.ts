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
    label: "Deploy real",
    body: "Del pago al servidor online en menos de un minuto. Sin colas, sin aprobación manual.",
  },
  {
    metric: "25 Tbps",
    label: "Mitigación DDoS",
    body: "Filtrado siempre activo en el borde de la red. No pagas extra por estar protegido.",
  },
  {
    metric: "Gen4",
    label: "NVMe en todo",
    body: "Cada plan, hasta el más pequeño, arranca sobre NVMe Gen4. Cero discos giratorios en cómputo.",
  },
  {
    metric: "10 Gbps",
    label: "Red por servidor",
    body: "Uplinks de 10 Gbps sin overselling. El ancho de banda que ves es el que tienes.",
  },
  {
    metric: "6",
    label: "Regiones EU",
    body: "Presencia distribuida en Europa con peering directo en los IXP principales.",
  },
  {
    metric: "24/7",
    label: "Soporte humano",
    body: "Ingeniería de guardia las 24 horas. Respuesta media bajo 10 minutos en incidencias.",
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
    title: "Aplicaciones web",
    bullets: [
      "Deploy en 60 s con NVMe Gen4",
      "Escala vertical sin migrar de host",
      "DDoS incluido para picos de tráfico",
    ],
    href: "/vps",
  },
  {
    n: "/02",
    title: "Bases de datos",
    bullets: [
      "IOPS sostenidos sobre NVMe Gen4",
      "RAM ECC en bare metal",
      "Red privada de baja latencia",
    ],
    href: "/dedicados/francia",
  },
  {
    n: "/03",
    title: "Enterprise",
    bullets: [
      "Bare metal dual EPYC dedicado",
      "10 Gbps con puerto garantizado",
      "SLA y soporte prioritario",
    ],
    href: "/dedicados/holanda",
  },
  {
    n: "/04",
    title: "SaaS y plataformas",
    bullets: [
      "Multi-región para baja latencia",
      "API de provisioning para autoescalar",
      "Facturación previsible por servidor",
    ],
    href: "/vps",
  },
];

/** 6 features cortas de seguridad para la sección DDoS. */
export const ddosFeatures: string[] = [
  "Detección en el borde < 2 s",
  "Filtrado L3/L4 y L7",
  "Reglas adaptativas por firma",
  "Always-on, sin reroute",
  "Sin coste por ataque",
  "Reporte de incidentes en panel",
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
  { city: "París", tz: "Europe/Paris" },
  { city: "Ámsterdam", tz: "Europe/Amsterdam" },
  { city: "Fráncfort", tz: "Europe/Berlin" },
  { city: "Londres", tz: "Europe/London" },
  { city: "Varsovia", tz: "Europe/Warsaw" },
];
