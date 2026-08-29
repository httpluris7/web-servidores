import { NextResponse } from "next/server";
import { redeemDelivery, ProvisionerError } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Canjea un enlace de entrega de un solo uso y devuelve las credenciales.
 *
 * Es POST a propósito: los escáneres de enlaces de los correos hacen GET, así
 * que abrir el correo NO consume el token; solo lo gasta el clic del cliente en
 * "Ver mi contraseña", que dispara este POST. La contraseña se revela una vez.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 10) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  try {
    const creds = await redeemDelivery(token);
    return NextResponse.json({ ok: true, creds });
  } catch (err) {
    if (err instanceof ProvisionerError) {
      if (err.status === 404) {
        return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
      }
      if (err.status === 410) {
        // Ya usado o caducado: el provisioner distingue en el mensaje.
        const expired = /expired/i.test(err.message);
        return NextResponse.json(
          { ok: false, reason: expired ? "expired" : "used" },
          { status: 410 },
        );
      }
      if (err.reason === "unconfigured") {
        return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });
      }
    }
    console.error("[entrega] fallo canjeando token:", err);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
