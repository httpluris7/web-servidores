import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Devuelve el usuario de la sesión actual (o null) para la UI del header. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const user = await getPublicUserById(session.uid);
  return NextResponse.json({
    user: user ? { id: user.id, nombre: user.nombre, email: user.email } : null,
  });
}
