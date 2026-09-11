import { NextResponse } from "next/server";
import { clean } from "@/lib/leads";
import { isPhoneValid } from "@/lib/password";
import { updateUserProfile } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Edición de los datos de perfil del propio usuario autenticado.
 * Mismas reglas de validación que el registro. El email no es editable desde
 * aquí (ver updateUserProfile en lib/auth.ts).
 */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  // Anti-abuso: máx. 20 actualizaciones por usuario cada 10 minutos.
  const limit = rateLimit(`perfil:${session.uid}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const nombre = clean(body.nombre, 80);
  const apellidos = clean(body.apellidos, 120);
  const direccion = clean(body.direccion, 200);
  const ciudad = clean(body.ciudad, 80);
  const estado = clean(body.estado, 80);
  const pais = clean(body.pais, 80);
  const telefono = clean(body.telefono, 30);
  const codigoPostal = clean(body.codigoPostal, 16);

  const errors: Record<string, string> = {};
  if (nombre.length < 2) errors.nombre = "Enter your name.";
  if (apellidos.length < 2) errors.apellidos = "Enter your last name.";
  if (direccion.length < 3) errors.direccion = "Enter your address.";
  if (ciudad.length < 2) errors.ciudad = "Enter your city.";
  if (estado.length < 2) errors.estado = "Enter your state.";
  if (pais.length < 2) errors.pais = "Enter your country.";
  if (!isPhoneValid(telefono)) errors.telefono = "Enter a valid phone number.";
  if (codigoPostal.length < 3) errors.codigoPostal = "Enter your postal code.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const user = await updateUserProfile(session.uid, {
    nombre,
    apellidos,
    direccion,
    ciudad,
    estado,
    pais,
    telefono,
    codigoPostal,
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
}
