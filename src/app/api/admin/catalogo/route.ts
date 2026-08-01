import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin";
import {
  actualizarCategoria,
  actualizarProducto,
  actualizarUbicacion,
  borrarCategoria,
  borrarProducto,
  borrarUbicacion,
  crearCategoria,
  crearProducto,
  crearUbicacion,
  esIdCatalogo,
  type ErrorCatalogo,
  type Resultado,
} from "@/lib/catalogo/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alta, edición y baja del catálogo desde `/admin/catalogo`.
 *
 * Una sola ruta para las tres entidades porque comparten guard, validación y —
 * lo importante— el mismo efecto secundario: el escaparate está prerenderizado,
 * así que tras tocar el catálogo hay que invalidar el árbol o los cambios no se
 * verían hasta el siguiente despliegue.
 */

type Entidad = "categoria" | "producto" | "ubicacion";
type Accion = "crear" | "actualizar" | "borrar";

const ENTIDADES: Entidad[] = ["categoria", "producto", "ubicacion"];
const ACCIONES: Accion[] = ["crear", "actualizar", "borrar"];

/** Código de error → estado HTTP. El cuerpo lleva el código para traducirlo. */
const ESTADO: Record<ErrorCatalogo, number> = {
  datos: 422,
  "no-encontrado": 404,
  "categoria-con-productos": 409,
  "categoria-vps-protegida": 409,
};

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "datos" }, { status: 400 });
  }

  const entidad = body.entidad as Entidad;
  const accion = body.accion as Accion;
  if (!ENTIDADES.includes(entidad) || !ACCIONES.includes(accion)) {
    return NextResponse.json({ ok: false, error: "datos" }, { status: 400 });
  }

  const datos = (body.datos && typeof body.datos === "object" ? body.datos : {}) as Record<
    string,
    unknown
  >;

  // El id se valida como UUID antes de usarlo para buscar nada: lo que no puede
  // existir se descarta en la puerta.
  let id = "";
  if (accion !== "crear") {
    id = typeof body.id === "string" ? body.id : "";
    if (!esIdCatalogo(id)) {
      return NextResponse.json({ ok: false, error: "no-encontrado" }, { status: 404 });
    }
  }

  const resultado = await ejecutar(entidad, accion, id, datos);

  if (!resultado.ok) {
    return NextResponse.json(
      { ok: false, error: resultado.error },
      { status: ESTADO[resultado.error] }
    );
  }

  // Todo el sitio público muestra catálogo (cabecera, pie, home, escaparate),
  // así que se invalida el layout entero en vez de ir ruta por ruta.
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, valor: resultado.valor });
}

function ejecutar(
  entidad: Entidad,
  accion: Accion,
  id: string,
  datos: Record<string, unknown>
): Promise<Resultado<unknown>> {
  if (entidad === "categoria") {
    if (accion === "crear") return crearCategoria(datos);
    if (accion === "actualizar") return actualizarCategoria(id, datos);
    return borrarCategoria(id);
  }
  if (entidad === "producto") {
    if (accion === "crear") return crearProducto(datos);
    if (accion === "actualizar") return actualizarProducto(id, datos);
    return borrarProducto(id);
  }
  if (accion === "crear") return crearUbicacion(datos);
  if (accion === "actualizar") return actualizarUbicacion(id, datos);
  return borrarUbicacion(id);
}
