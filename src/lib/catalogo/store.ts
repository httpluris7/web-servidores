import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { catalogoInicial } from "./seed";

/**
 * Catálogo editable desde el panel (`/admin/catalogo`).
 *
 * Antes vivía escrito a mano en `src/data/products.ts`, lo que obligaba a tocar
 * código y reconstruir para cambiar un precio. Ahora vive en
 * `data/catalogo.json` y `src/data/products.ts` se limita a resolverlo con la
 * forma que ya esperaban las páginas.
 *
 * Tres entidades, que son las tres cosas que el sitio sabe pintar:
 *
 *  - `Categoria`: la línea de producto. Hay una de tipo `vps` (la familia Cloud
 *    VPS, que se publica en `/vps`) y N de tipo `dedicados`, cada una con su
 *    página `/dedicados/<slug>`. Son las únicas dos rutas de producto que
 *    existen, así que una categoría nueva es siempre de tipo `dedicados`.
 *  - `Producto`: el plan concreto que se contrata, dentro de una categoría.
 *  - `Ubicacion`: las regiones donde se despliega el VPS (`/vps/<slug>`).
 *
 * Los textos que ve el visitante son multiidioma porque el sitio lo es; `en` es
 * obligatorio y `es`/`fr` vacíos caen a `en` (ver `texto()`). Esto sustituye a
 * las claves `products.vps.regions.*` y `products.dedicated.types.*` de
 * `messages/`, que ya no se usan: una sola fuente de verdad.
 *
 * Se lee del disco en cada petición —el fichero es diminuto— para que un cambio
 * en el panel tenga efecto sin reiniciar el proceso.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "catalogo.json");

export const CATALOG_LOCALES = ["en", "es", "fr"] as const;
export type CatalogLocale = (typeof CATALOG_LOCALES)[number];

/** Texto en los tres idiomas del sitio. */
export type Texto = Record<CatalogLocale, string>;

export type CategoriaTipo = "vps" | "dedicados";

export type Categoria = {
  id: string;
  /** Determina la ruta pública: `vps` → `/vps`, `dedicados` → `/dedicados/<slug>`. */
  tipo: CategoriaTipo;
  slug: string;
  nombre: Texto;
  /** El "tagline" que se pinta bajo el título. */
  descripcion: Texto;
  /** Etiqueta corta en mono sobre el título ("🇫🇷 Paris · bare metal"). */
  etiqueta: Texto;
  visible: boolean;
  orden: number;
  creadoAt: string;
  actualizadoAt: string;
};

export type Producto = {
  id: string;
  categoriaId: string;
  /**
   * Identificador público y ESTABLE del plan: va en la URL de contratación
   * (`/contratar/<planId>`), en el carrito del navegador y en las líneas de
   * factura ya emitidas. Se genera al crear y no se puede cambiar después.
   */
  planId: string;
  nombre: string;
  cpu: string;
  ram: string;
  almacenamiento: string;
  red: string;
  /** €/mes. */
  precio: number;
  popular: boolean;
  visible: boolean;
  orden: number;
  creadoAt: string;
  actualizadoAt: string;
};

export type Ubicacion = {
  id: string;
  slug: string;
  nombre: Texto;
  ciudad: Texto;
  /** Nota de latencia que se muestra junto a la ciudad. */
  nota: Texto;
  /** Emoji de bandera. */
  bandera: string;
  /** €/mes "desde" que se anuncia para la ubicación. */
  precioDesde: number;
  /** Coordenadas relativas (0–100) sobre el SVG del mapa de Europa. */
  mapX: number;
  mapY: number;
  visible: boolean;
  orden: number;
  creadoAt: string;
  actualizadoAt: string;
};

export type Catalogo = {
  categorias: Categoria[];
  productos: Producto[];
  ubicaciones: Ubicacion[];
};

/** El texto en el idioma pedido, cayendo a inglés si no está traducido. */
export function texto(t: Texto | undefined, locale: string): string {
  if (!t) return "";
  const propio = t[locale as CatalogLocale];
  return (propio && propio.trim()) || t.en || "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ¿Tiene forma de id nuestro? Se comprueba antes de usarlo para buscar nada. */
export function esIdCatalogo(id: string): boolean {
  return UUID_RE.test(id);
}

/* ------------------------------- Persistencia ----------------------------- */

/** Normaliza lo leído del disco: lo que no encaje se descarta o se completa. */
function sanear(raw: unknown): Catalogo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<Catalogo>;
  if (!Array.isArray(o.categorias) || !Array.isArray(o.productos) || !Array.isArray(o.ubicaciones)) {
    return null;
  }
  return {
    categorias: o.categorias.filter((c) => c && typeof c.id === "string"),
    productos: o.productos.filter((p) => p && typeof p.id === "string"),
    ubicaciones: o.ubicaciones.filter((u) => u && typeof u.id === "string"),
  };
}

export async function readCatalogo(): Promise<Catalogo> {
  try {
    const saneado = sanear(JSON.parse(await readFile(FILE, "utf8")));
    if (saneado) return saneado;
  } catch {
    // No existe todavía (o está ilegible): se siembra con el catálogo de partida.
  }
  const inicial = catalogoInicial();
  try {
    await writeCatalogo(inicial);
  } catch {
    // Disco de solo lectura o build en un contenedor: se sirve en memoria.
  }
  return inicial;
}

export async function writeCatalogo(catalogo: Catalogo): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  // Escritura a un temporal + rename: el `readCatalogo` de otra petición nunca
  // llega a ver medio fichero, ni aunque el build arranque varios procesos.
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(catalogo, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, FILE);
}

/* --------------------------------- Ayudas --------------------------------- */

/** Slug url-safe a partir de un texto libre. */
export function slugify(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas sueltas tras el NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

/** Añade `-2`, `-3`… hasta que el slug no choque con ninguno de `usados`. */
function slugLibre(base: string, usados: Set<string>): string {
  if (!usados.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const intento = `${base}-${n}`;
    if (!usados.has(intento)) return intento;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function ahora(): string {
  return new Date().toISOString();
}

/** Texto multiidioma a partir de lo que llegue del formulario. */
function comoTexto(raw: unknown, maxLen = 400): Texto {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const uno = (k: CatalogLocale) => (typeof o[k] === "string" ? o[k].trim().slice(0, maxLen) : "");
  return { en: uno("en"), es: uno("es"), fr: uno("fr") };
}

function comoLinea(raw: unknown, maxLen = 120): string {
  return typeof raw === "string" ? raw.trim().slice(0, maxLen) : "";
}

function comoPrecio(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Dos decimales: los precios se muestran y se facturan en euros.
  return Math.round(Math.min(n, 1_000_000) * 100) / 100;
}

function comoCoordenada(raw: unknown, porDefecto: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
}

/** Resultado de una mutación: o sale bien, o dice por qué no. */
export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: ErrorCatalogo };

export type ErrorCatalogo =
  | "datos" // faltan campos obligatorios
  | "no-encontrado"
  | "categoria-con-productos" // no se borra una categoría que aún vende algo
  | "categoria-vps-protegida"; // la familia VPS es única y la usan /vps y /vps/<region>

const err = (error: ErrorCatalogo): Resultado<never> => ({ ok: false, error });

/* ------------------------------- Categorías ------------------------------- */

export async function crearCategoria(datos: Record<string, unknown>): Promise<Resultado<Categoria>> {
  const nombre = comoTexto(datos.nombre, 120);
  if (!nombre.en) return err("datos");

  const catalogo = await readCatalogo();
  const usados = new Set(catalogo.categorias.map((c) => c.slug));
  const momento = ahora();
  // El tipo no se pide: la única ruta de producto que admite categorías nuevas
  // es `/dedicados/<slug>`; la familia VPS es única y ya existe.
  const categoria: Categoria = {
    id: randomUUID(),
    tipo: "dedicados",
    slug: slugLibre(slugify(comoLinea(datos.slug) || nombre.en) || "categoria", usados),
    nombre,
    descripcion: comoTexto(datos.descripcion, 400),
    etiqueta: comoTexto(datos.etiqueta, 80),
    visible: datos.visible !== false,
    orden: catalogo.categorias.length,
    creadoAt: momento,
    actualizadoAt: momento,
  };

  await writeCatalogo({ ...catalogo, categorias: [...catalogo.categorias, categoria] });
  return { ok: true, valor: categoria };
}

export async function actualizarCategoria(
  id: string,
  datos: Record<string, unknown>
): Promise<Resultado<Categoria>> {
  const catalogo = await readCatalogo();
  const actual = catalogo.categorias.find((c) => c.id === id);
  if (!actual) return err("no-encontrado");

  const nombre = comoTexto(datos.nombre, 120);
  if (!nombre.en) return err("datos");

  // El slug de la familia VPS no se toca: `/vps` no es una ruta paramétrica.
  const usados = new Set(catalogo.categorias.filter((c) => c.id !== id).map((c) => c.slug));
  const slug =
    actual.tipo === "vps"
      ? actual.slug
      : slugLibre(slugify(comoLinea(datos.slug) || nombre.en) || actual.slug, usados);

  const actualizada: Categoria = {
    ...actual,
    slug,
    nombre,
    descripcion: comoTexto(datos.descripcion, 400),
    etiqueta: comoTexto(datos.etiqueta, 80),
    visible: datos.visible !== false,
    orden: Number.isFinite(Number(datos.orden)) ? Number(datos.orden) : actual.orden,
    actualizadoAt: ahora(),
  };

  await writeCatalogo({
    ...catalogo,
    categorias: catalogo.categorias.map((c) => (c.id === id ? actualizada : c)),
  });
  return { ok: true, valor: actualizada };
}

export async function borrarCategoria(id: string): Promise<Resultado<null>> {
  const catalogo = await readCatalogo();
  const actual = catalogo.categorias.find((c) => c.id === id);
  if (!actual) return err("no-encontrado");
  if (actual.tipo === "vps") return err("categoria-vps-protegida");
  // Borrar la categoría dejaría sus planes fuera de toda página pero seguirían
  // contratables por URL: se exige vaciarla antes, que además es reversible.
  if (catalogo.productos.some((p) => p.categoriaId === id)) return err("categoria-con-productos");

  await writeCatalogo({ ...catalogo, categorias: catalogo.categorias.filter((c) => c.id !== id) });
  return { ok: true, valor: null };
}

/* -------------------------------- Productos ------------------------------- */

export async function crearProducto(datos: Record<string, unknown>): Promise<Resultado<Producto>> {
  const nombre = comoLinea(datos.nombre);
  const categoriaId = comoLinea(datos.categoriaId, 64);
  if (!nombre) return err("datos");

  const catalogo = await readCatalogo();
  const categoria = catalogo.categorias.find((c) => c.id === categoriaId);
  if (!categoria) return err("no-encontrado");

  // El planId se deriva del nombre y se prefija con la categoría para que dos
  // planes iguales en países distintos no colisionen (`ded-fr-…`/`ded-nl-…`).
  const usados = new Set(catalogo.productos.map((p) => p.planId));
  const prefijo = categoria.tipo === "vps" ? "vps" : `ded-${categoria.slug}`;
  const base = slugify(`${prefijo}-${nombre}`) || "plan";
  const momento = ahora();

  const hermanos = catalogo.productos.filter((p) => p.categoriaId === categoriaId);
  const producto: Producto = {
    id: randomUUID(),
    categoriaId,
    planId: slugLibre(base, usados),
    nombre,
    cpu: comoLinea(datos.cpu),
    ram: comoLinea(datos.ram),
    almacenamiento: comoLinea(datos.almacenamiento),
    red: comoLinea(datos.red),
    precio: comoPrecio(datos.precio),
    popular: datos.popular === true,
    visible: datos.visible !== false,
    orden: hermanos.length,
    creadoAt: momento,
    actualizadoAt: momento,
  };

  await writeCatalogo({
    ...catalogo,
    productos: aplicarPopularUnico([...catalogo.productos, producto], producto),
  });
  return { ok: true, valor: producto };
}

export async function actualizarProducto(
  id: string,
  datos: Record<string, unknown>
): Promise<Resultado<Producto>> {
  const catalogo = await readCatalogo();
  const actual = catalogo.productos.find((p) => p.id === id);
  if (!actual) return err("no-encontrado");

  const nombre = comoLinea(datos.nombre);
  if (!nombre) return err("datos");

  // Mover de categoría sí se permite; inventarse una que no existe, no.
  const destino = comoLinea(datos.categoriaId, 64);
  const categoriaId =
    destino && catalogo.categorias.some((c) => c.id === destino) ? destino : actual.categoriaId;

  const actualizado: Producto = {
    ...actual,
    categoriaId,
    // `planId` NO se toca: rompería las URLs de contratación y los carritos ya
    // guardados en el navegador de los clientes.
    nombre,
    cpu: comoLinea(datos.cpu),
    ram: comoLinea(datos.ram),
    almacenamiento: comoLinea(datos.almacenamiento),
    red: comoLinea(datos.red),
    precio: comoPrecio(datos.precio),
    popular: datos.popular === true,
    visible: datos.visible !== false,
    orden: Number.isFinite(Number(datos.orden)) ? Number(datos.orden) : actual.orden,
    actualizadoAt: ahora(),
  };

  await writeCatalogo({
    ...catalogo,
    productos: aplicarPopularUnico(
      catalogo.productos.map((p) => (p.id === id ? actualizado : p)),
      actualizado
    ),
  });
  return { ok: true, valor: actualizado };
}

export async function borrarProducto(id: string): Promise<Resultado<null>> {
  const catalogo = await readCatalogo();
  if (!catalogo.productos.some((p) => p.id === id)) return err("no-encontrado");
  await writeCatalogo({ ...catalogo, productos: catalogo.productos.filter((p) => p.id !== id) });
  return { ok: true, valor: null };
}

/**
 * "Más popular" es un distintivo visual de una tarjeta por categoría: marcar
 * uno desmarca al resto de su categoría, para no pintar dos cintas a la vez.
 */
function aplicarPopularUnico(productos: Producto[], reciente: Producto): Producto[] {
  if (!reciente.popular) return productos;
  return productos.map((p) =>
    p.id !== reciente.id && p.categoriaId === reciente.categoriaId && p.popular
      ? { ...p, popular: false }
      : p
  );
}

/* ------------------------------- Ubicaciones ------------------------------ */

export async function crearUbicacion(datos: Record<string, unknown>): Promise<Resultado<Ubicacion>> {
  const nombre = comoTexto(datos.nombre, 80);
  if (!nombre.en) return err("datos");

  const catalogo = await readCatalogo();
  const usados = new Set(catalogo.ubicaciones.map((u) => u.slug));
  const momento = ahora();
  const ubicacion: Ubicacion = {
    id: randomUUID(),
    slug: slugLibre(slugify(comoLinea(datos.slug) || nombre.en) || "ubicacion", usados),
    nombre,
    ciudad: comoTexto(datos.ciudad, 80),
    nota: comoTexto(datos.nota, 160),
    bandera: comoLinea(datos.bandera, 8),
    precioDesde: comoPrecio(datos.precioDesde),
    mapX: comoCoordenada(datos.mapX, 50),
    mapY: comoCoordenada(datos.mapY, 50),
    visible: datos.visible !== false,
    orden: catalogo.ubicaciones.length,
    creadoAt: momento,
    actualizadoAt: momento,
  };

  await writeCatalogo({ ...catalogo, ubicaciones: [...catalogo.ubicaciones, ubicacion] });
  return { ok: true, valor: ubicacion };
}

export async function actualizarUbicacion(
  id: string,
  datos: Record<string, unknown>
): Promise<Resultado<Ubicacion>> {
  const catalogo = await readCatalogo();
  const actual = catalogo.ubicaciones.find((u) => u.id === id);
  if (!actual) return err("no-encontrado");

  const nombre = comoTexto(datos.nombre, 80);
  if (!nombre.en) return err("datos");

  const usados = new Set(catalogo.ubicaciones.filter((u) => u.id !== id).map((u) => u.slug));
  const actualizada: Ubicacion = {
    ...actual,
    slug: slugLibre(slugify(comoLinea(datos.slug) || nombre.en) || actual.slug, usados),
    nombre,
    ciudad: comoTexto(datos.ciudad, 80),
    nota: comoTexto(datos.nota, 160),
    bandera: comoLinea(datos.bandera, 8),
    precioDesde: comoPrecio(datos.precioDesde),
    mapX: comoCoordenada(datos.mapX, actual.mapX),
    mapY: comoCoordenada(datos.mapY, actual.mapY),
    visible: datos.visible !== false,
    orden: Number.isFinite(Number(datos.orden)) ? Number(datos.orden) : actual.orden,
    actualizadoAt: ahora(),
  };

  await writeCatalogo({
    ...catalogo,
    ubicaciones: catalogo.ubicaciones.map((u) => (u.id === id ? actualizada : u)),
  });
  return { ok: true, valor: actualizada };
}

export async function borrarUbicacion(id: string): Promise<Resultado<null>> {
  const catalogo = await readCatalogo();
  if (!catalogo.ubicaciones.some((u) => u.id === id)) return err("no-encontrado");
  await writeCatalogo({
    ...catalogo,
    ubicaciones: catalogo.ubicaciones.filter((u) => u.id !== id),
  });
  return { ok: true, valor: null };
}
