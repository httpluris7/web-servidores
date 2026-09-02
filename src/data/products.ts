/**
 * Catálogo de productos ViaHost.
 *
 * Los datos ya no viven aquí: se editan desde `/admin/catalogo` y se guardan en
 * `data/catalogo.json` (ver `src/lib/catalogo/store.ts`). Este módulo es la capa
 * de lectura: resuelve el almacén al idioma pedido y lo devuelve con las mismas
 * formas (`Region`, `Plan`, `ProductLine`, `DedicatedType`) que ya esperaban las
 * páginas, para que pintar un plan siga siendo exactamente igual que antes.
 *
 * Todo lo que se exporta es asíncrono a propósito: lee de disco. Los
 * componentes de cliente NO deben importar de aquí más que los tipos —el
 * almacén usa `node:fs` y el bundle no compilaría—; los datos les llegan como
 * props desde la página o el layout que los renderiza.
 */

import { deployUrl } from "./site";
import { defaultVpsRegionSlug } from "@/lib/regions";
import {
  readCatalogo,
  texto,
  type Categoria,
  type Producto,
  type Ubicacion,
} from "@/lib/catalogo/store";

export type Region = {
  slug: string;
  name: string;
  flag: string; // emoji bandera (placeholder visual; sustituible por SVG propio)
  city: string;
  priceFrom: number; // €/mes desde
  latencyNote?: string;
  /** Marca de CPU de la región; sustituye la del plan en `/vps/<slug>`. */
  cpu?: string;
  /** Location del provisioner (p. ej. "nl-ams"); si existe, la región se aprovisiona sola. */
  provisionLocation?: string;
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
  /** Región a la que el plan es exclusivo; si falta, es global (ver `Producto`). */
  ubicacionSlug?: string;
};

export type ProductLine = {
  slug: string;
  title: string;
  tagline: string;
  regions?: Region[];
  plans: Plan[];
};

export type DedicatedType = {
  slug: string;
  title: string;
  tagline: string;
  highlight: string; // etiqueta corta mono
  plans: Plan[];
};

/** Plan localizado junto a la línea de producto a la que pertenece. */
export type LocatedPlan = {
  plan: Plan;
  lineSlug: string;
  lineTitle: string;
  /** `vps` admite región de despliegue; `hosting` y `dedicados` no. */
  lineTipo: "vps" | "dedicados" | "hosting";
};

/** El catálogo público completo, ya resuelto a un idioma. */
export type Catalog = {
  regions: Region[];
  vps: ProductLine;
  /** Familia única de Hosting Web (cPanel); `null` si no está en el catálogo. */
  hosting: ProductLine | null;
  dedicatedTypes: DedicatedType[];
  allPlans: LocatedPlan[];
};

/* --------------------------------- Mapeo ---------------------------------- */

const porOrden = <T extends { orden: number }>(a: T, b: T) => a.orden - b.orden;

function aRegion(u: Ubicacion, locale: string): Region {
  const nota = texto(u.nota, locale);
  const cpu = (u.cpu ?? "").trim();
  const provisionLocation = (u.provisionLocation ?? "").trim();
  return {
    slug: u.slug,
    name: texto(u.nombre, locale),
    flag: u.bandera,
    city: texto(u.ciudad, locale),
    priceFrom: u.precioDesde,
    ...(nota ? { latencyNote: nota } : {}),
    ...(cpu ? { cpu } : {}),
    ...(provisionLocation ? { provisionLocation } : {}),
    map: { x: u.mapX, y: u.mapY },
  };
}

function aPlan(p: Producto): Plan {
  return {
    id: p.planId,
    name: p.nombre,
    cpu: p.cpu,
    ram: p.ram,
    storage: p.almacenamiento,
    bandwidth: p.red,
    price: p.precio,
    orderUrl: deployUrl(`/order/${p.planId}`),
    ...(p.popular ? { popular: true } : {}),
    ...(((p.ubicacionSlug ?? "").trim()) ? { ubicacionSlug: (p.ubicacionSlug as string).trim() } : {}),
  };
}

/**
 * Línea de reserva: el almacén protege la categoría VPS de borrado, pero un
 * `catalogo.json` editado a mano podría no traerla y no queremos reventar.
 */
const LINEA_VPS_VACIA: ProductLine = { slug: "vps", title: "Cloud VPS", tagline: "", plans: [] };

/* -------------------------------- Lectura --------------------------------- */

/**
 * El catálogo público en un idioma: solo lo marcado como visible, en el orden
 * que se le haya dado en el panel.
 */
export async function getCatalog(locale = "en"): Promise<Catalog> {
  const { categorias, productos, ubicaciones } = await readCatalogo();

  const visibles = productos.filter((p) => p.visible).sort(porOrden);
  const planesDe = (categoria: Categoria) =>
    visibles.filter((p) => p.categoriaId === categoria.id).map(aPlan);

  const regions = ubicaciones
    .filter((u) => u.visible)
    .sort(porOrden)
    .map((u) => aRegion(u, locale));

  const publicas = categorias.filter((c) => c.visible).sort(porOrden);

  const catVps = publicas.find((c) => c.tipo === "vps");
  // La familia VPS admite gamas por región: los productos con `ubicacionSlug` son
  // exclusivos de esa región; los que no lo tienen son GLOBALES. `vps.plans` (la
  // línea base y la página /vps general) muestra solo los globales; `allPlans`
  // incluye todos (para que /contratar/<planId>, carrito y validación resuelvan
  // también los específicos). Ver `vpsPlansForRegion` y `regionsForPlan`.
  const vpsProductos = catVps ? visibles.filter((p) => p.categoriaId === catVps.id) : [];
  const vpsPlanesTodos = vpsProductos.map(aPlan);
  const vpsPlanesGlobales = vpsPlanesTodos.filter((p) => !(p.ubicacionSlug ?? "").trim());
  const vps: ProductLine = catVps
    ? {
        slug: catVps.slug,
        title: texto(catVps.nombre, locale),
        tagline: texto(catVps.descripcion, locale),
        regions,
        plans: vpsPlanesGlobales,
      }
    : { ...LINEA_VPS_VACIA, regions };

  // Hosting Web: familia única (como VPS), sin regiones. Se publica en `/hosting`.
  const catHosting = publicas.find((c) => c.tipo === "hosting");
  const hostingPlanes = catHosting
    ? visibles.filter((p) => p.categoriaId === catHosting.id).map(aPlan)
    : [];
  const hosting: ProductLine | null = catHosting
    ? {
        slug: catHosting.slug,
        title: texto(catHosting.nombre, locale),
        tagline: texto(catHosting.descripcion, locale),
        plans: hostingPlanes,
      }
    : null;

  const dedicatedTypes: DedicatedType[] = publicas
    .filter((c) => c.tipo === "dedicados")
    .map((c) => ({
      slug: c.slug,
      title: texto(c.nombre, locale),
      tagline: texto(c.descripcion, locale),
      highlight: texto(c.etiqueta, locale),
      plans: planesDe(c),
    }));

  const allPlans: LocatedPlan[] = [
    ...vpsPlanesTodos.map((plan) => ({
      plan,
      lineSlug: vps.slug,
      lineTitle: vps.title,
      lineTipo: "vps" as const,
    })),
    ...(hosting
      ? hosting.plans.map((plan) => ({
          plan,
          lineSlug: hosting.slug,
          lineTitle: hosting.title,
          lineTipo: "hosting" as const,
        }))
      : []),
    ...dedicatedTypes.flatMap((d) =>
      d.plans.map((plan) => ({
        plan,
        lineSlug: d.slug,
        lineTitle: d.title,
        lineTipo: "dedicados" as const,
      }))
    ),
  ];

  return { regions, vps, hosting, dedicatedTypes, allPlans };
}

/** La familia de Hosting Web resuelta a un idioma (o `null` si no está publicada). */
export async function getHostingLine(locale = "en"): Promise<ProductLine | null> {
  return (await getCatalog(locale)).hosting;
}

export async function getRegions(locale = "en"): Promise<Region[]> {
  return (await getCatalog(locale)).regions;
}

export async function getRegion(slug: string, locale = "en"): Promise<Region | undefined> {
  return (await getCatalog(locale)).regions.find((r) => r.slug === slug);
}

export async function getDedicatedTypes(locale = "en"): Promise<DedicatedType[]> {
  return (await getCatalog(locale)).dedicatedTypes;
}

export async function getDedicatedType(
  slug: string,
  locale = "en"
): Promise<DedicatedType | undefined> {
  return (await getCatalog(locale)).dedicatedTypes.find((d) => d.slug === slug);
}

export async function getAllPlans(locale = "en"): Promise<LocatedPlan[]> {
  return (await getCatalog(locale)).allPlans;
}

/**
 * Un plan contratable por su id público. Los ocultos no se resuelven: retirar un
 * plan del catálogo lo saca también del carrito y de las rutas de pago.
 */
export async function getPlanById(id: string, locale = "en"): Promise<LocatedPlan | undefined> {
  return (await getCatalog(locale)).allPlans.find((p) => p.plan.id === id);
}

/** Regiones VPS con gama propia (alguna con planes exclusivos suyos). */
function regionesConGamaPropia(allPlans: LocatedPlan[]): Set<string> {
  const s = new Set<string>();
  for (const lp of allPlans) {
    if (lp.lineTipo === "vps" && lp.plan.ubicacionSlug) s.add(lp.plan.ubicacionSlug);
  }
  return s;
}

/**
 * Planes VPS a mostrar en `/vps/<region>`: la gama propia de la región si la
 * tiene, o los globales en su defecto.
 */
export function vpsPlansForRegion(catalog: Catalog, regionSlug: string): Plan[] {
  const propios = catalog.allPlans
    .filter((lp) => lp.lineTipo === "vps" && lp.plan.ubicacionSlug === regionSlug)
    .map((lp) => lp.plan);
  return propios.length ? propios : catalog.vps.plans;
}

/**
 * Regiones donde un plan es contratable: un plan exclusivo, solo en su región; un
 * plan global, en toda región que NO tenga gama propia. (Dedicados: sin región.)
 */
export function regionsForPlan(catalog: Catalog, planId: string): Region[] {
  const lp = catalog.allPlans.find((x) => x.plan.id === planId);
  if (!lp || lp.lineTipo !== "vps") return catalog.regions;
  const esp = lp.plan.ubicacionSlug;
  if (esp) return catalog.regions.filter((r) => r.slug === esp);
  const propias = regionesConGamaPropia(catalog.allPlans);
  return catalog.regions.filter((r) => !propias.has(r.slug));
}

/* -------------------------------------------------------------------------- */
/*  Catálogo para el selector de líneas de factura (panel admin)              */
/* -------------------------------------------------------------------------- */

/** Producto del catálogo ofrecido en el desplegable al crear una factura. */
export type InvoiceProduct = {
  id: string; // id del plan (referencia para la línea de factura)
  label: string; // "VPS Pro · Cloud VPS"
  price: number; // €/mes (precio unitario sugerido)
};

/**
 * Opciones del selector de facturas. Aquí SÍ entran los planes ocultos: un plan
 * retirado del escaparate se sigue facturando a quien ya lo tiene contratado.
 */
export async function getInvoiceCatalog(locale = "en"): Promise<InvoiceProduct[]> {
  const { categorias, productos } = await readCatalogo();
  const titulo = new Map(categorias.map((c) => [c.id, texto(c.nombre, locale)]));
  return [...productos].sort(porOrden).map((p) => {
    const linea = titulo.get(p.categoriaId);
    return {
      id: p.planId,
      label: linea ? `${p.nombre} · ${linea}` : p.nombre,
      price: p.precio,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Vistas reducidas para los componentes de cliente                          */
/* -------------------------------------------------------------------------- */

/**
 * Lo justo que necesitan la cabecera, el menú móvil y el pie para construir
 * sus enlaces. Va como prop desde el layout porque son componentes de cliente
 * (o síncronos) y no pueden leer del disco.
 */
export type NavCatalog = {
  regions: { slug: string; flag: string; name: string; priceFrom: number }[];
  lines: { slug: string; title: string; highlight: string }[];
  /** Familia Hosting Web para el menú (o `null` si no hay planes publicados). */
  hosting: { slug: string; title: string; priceFrom: number } | null;
};

export async function getNavCatalog(locale = "en"): Promise<NavCatalog> {
  const { regions, dedicatedTypes, hosting } = await getCatalog(locale);
  return {
    regions: regions.map((r) => ({
      slug: r.slug,
      flag: r.flag,
      name: r.name,
      priceFrom: r.priceFrom,
    })),
    lines: dedicatedTypes.map((d) => ({
      slug: d.slug,
      title: d.title,
      highlight: d.highlight,
    })),
    hosting:
      hosting && hosting.plans.length
        ? {
            slug: hosting.slug,
            title: hosting.title,
            priceFrom: Math.min(...hosting.plans.map((p) => p.price)),
          }
        : null,
  };
}

/**
 * El carrito vive en el navegador y resuelve contra el catálogo en cada render
 * (nunca guarda precios), así que necesita la lista completa de planes.
 */
export type CartCatalog = {
  plans: LocatedPlan[];
  /** Región preseleccionada al añadir un VPS; null si no hay ubicaciones. */
  defaultRegion: string | null;
};

export async function getCartCatalog(locale = "en"): Promise<CartCatalog> {
  const { allPlans, regions } = await getCatalog(locale);
  // Región preseleccionada al añadir un VPS: la primera provisionable, nunca una
  // región sin Proxmox que dejaría el pedido sin aprovisionar (ver `regions.ts`).
  return { plans: allPlans, defaultRegion: regions.length ? defaultVpsRegionSlug(regions) : null };
}
