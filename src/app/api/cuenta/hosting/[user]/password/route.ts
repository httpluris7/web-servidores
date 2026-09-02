import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { usuarioTieneHosting } from "@/lib/hosting/intents";
import { changeAccountPassword, WhmError } from "@/lib/hosting/whm";
import { generarPasswordCpanel } from "@/lib/hosting/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usuario de cPanel: empieza por letra, alfanumérico, hasta 16 chars.
const USER_RE = /^[a-z][a-z0-9]{1,15}$/;

/**
 * Resetea la contraseña de acceso de una cuenta de cPanel del cliente.
 *
 * El parámetro `[user]` es el usuario de cPanel; la PROPIEDAD se comprueba con
 * `usuarioTieneHosting` (único punto, como el editor de DNS): una cuenta ajena
 * responde 404. Se genera una contraseña fuerte, se aplica vía WHM y se
 * devuelve UNA vez para que el cliente la copie —no se guarda ni se registra—.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ user: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const { user } = await ctx.params;
  const cpanelUser = decodeURIComponent(user).toLowerCase();
  if (!USER_RE.test(cpanelUser)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // Resetear no es frecuente: 3 por hora por (usuario, cuenta).
  const rl = rateLimit(`hosting-passwd:${session.uid}:${cpanelUser}`, { limit: 3, windowMs: 3_600_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (!(await usuarioTieneHosting(session.uid, cpanelUser))) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const password = generarPasswordCpanel();
  try {
    await changeAccountPassword(cpanelUser, password);
  } catch (err) {
    console.error(
      "[hosting] fallo reseteando contraseña de",
      cpanelUser,
      err instanceof WhmError ? `${err.reason} ${err.message}` : err,
    );
    return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, password });
}
