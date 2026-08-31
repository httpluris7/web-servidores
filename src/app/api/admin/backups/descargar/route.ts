import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { LOCAL_DIR } from "@/lib/backup/historial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga de una copia local cifrada para guardarla fuera del servidor (la
 * pata del 3-2-1 que no depende ni de Dropbox ni del SFTP). El fichero ya va
 * cifrado, pero la ruta está protegida igual: solo admin, y el nombre se acota
 * a un basename dentro de `data/backups/` para que no se pueda pedir otra cosa.
 */
export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }
  const nombre = new URL(req.url).searchParams.get("nombre") || "";
  const base = path.basename(nombre);
  if (base !== nombre || !base.startsWith("viahost-backup-") || !base.endsWith(".vhbk")) {
    return NextResponse.json({ ok: false, error: "Nombre de copia no válido." }, { status: 400 });
  }
  let datos: Buffer;
  try {
    datos = await readFile(path.join(LOCAL_DIR, base));
  } catch {
    return NextResponse.json({ ok: false, error: "La copia no existe." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(datos), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${base}"`,
      "Content-Length": String(datos.length),
      "Cache-Control": "no-store",
    },
  });
}
