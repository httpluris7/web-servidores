import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { maskSecret, readSettings, updateBackupSettings, type BackupSettings } from "@/lib/ajustes";
import { ejecutarBackup, leerHistorial, listarLocales, probarDestino } from "@/lib/backup/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vista pública de la configuración de copias: NUNCA salen en claro la frase de
 * cifrado, el token de Dropbox ni la clave SFTP, solo su versión enmascarada y
 * si están puestos. El `appKey` de Dropbox sí es un identificador público.
 */
function publicView(b: BackupSettings) {
  return {
    enabled: b.enabled,
    hour: b.hour,
    retain: b.retain,
    keepLocal: b.keepLocal,
    hasPassphrase: !!b.passphrase,
    dropboxEnabled: b.dropboxEnabled,
    sftpEnabled: b.sftpEnabled,
    dropbox: {
      folder: b.dropbox.folder,
      appKey: b.dropbox.appKey,
      hasAccessToken: !!b.dropbox.accessToken,
      accessTokenMask: maskSecret(b.dropbox.accessToken),
      hasRefreshToken: !!b.dropbox.refreshToken,
      refreshTokenMask: maskSecret(b.dropbox.refreshToken),
      hasAppSecret: !!b.dropbox.appSecret,
    },
    sftp: {
      host: b.sftp.host,
      port: b.sftp.port,
      user: b.sftp.user,
      dir: b.sftp.dir,
      hasPrivateKey: !!b.sftp.privateKey,
    },
  };
}

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }
  const { backup } = await readSettings();
  const [historial, locales] = await Promise.all([leerHistorial(30), listarLocales()]);
  return NextResponse.json({
    ok: true,
    config: publicView(backup),
    historial,
    locales,
  });
}

/** Lee un secreto entrante: `null` lo borra, ausente/vacío lo conserva. */
function readSecret(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  return v; // el trim/preservación lo hace updateBackupSettings
}

export async function PUT(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v.trim() : undefined);

  // Validaciones de lo que el usuario puede escribir mal sin darse cuenta.
  const hour = num(body.hour);
  if (hour !== undefined && (hour < 0 || hour > 23)) {
    return NextResponse.json({ ok: false, error: "La hora debe estar entre 0 y 23." }, { status: 422 });
  }
  const port = body.sftp && typeof body.sftp === "object" ? num((body.sftp as Record<string, unknown>).port) : undefined;
  if (port !== undefined && (port < 1 || port > 65535)) {
    return NextResponse.json({ ok: false, error: "El puerto SFTP no es válido." }, { status: 422 });
  }
  const dropbox = (body.dropbox ?? {}) as Record<string, unknown>;
  const sftp = (body.sftp ?? {}) as Record<string, unknown>;

  const folder = str(dropbox.folder);
  if (folder !== undefined && folder && !folder.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "La carpeta de Dropbox debe empezar por «/»." }, { status: 422 });
  }
  const pem = readSecret(sftp.privateKey);
  if (typeof pem === "string" && pem.trim() && !/PRIVATE KEY/.test(pem)) {
    return NextResponse.json(
      { ok: false, error: "La clave SFTP no parece una clave privada en formato PEM." },
      { status: 422 }
    );
  }

  const settings = await updateBackupSettings({
    enabled: bool(body.enabled),
    hour,
    passphrase: readSecret(body.passphrase),
    retain: num(body.retain),
    keepLocal: bool(body.keepLocal),
    dropboxEnabled: bool(body.dropboxEnabled),
    sftpEnabled: bool(body.sftpEnabled),
    dropbox: {
      accessToken: readSecret(dropbox.accessToken),
      refreshToken: readSecret(dropbox.refreshToken),
      appKey: str(dropbox.appKey),
      appSecret: readSecret(dropbox.appSecret),
      folder,
    },
    sftp: {
      host: str(sftp.host),
      port,
      user: str(sftp.user),
      dir: str(sftp.dir),
      privateKey: pem,
    },
  });

  const b = settings.backup;
  const warning =
    b.enabled && !b.passphrase
      ? "La programación está activa pero no hay frase de cifrado: no se generará ninguna copia."
      : b.enabled && !b.keepLocal && !b.dropboxEnabled && !b.sftpEnabled
        ? "La programación está activa pero no hay ningún destino."
        : null;

  return NextResponse.json({ ok: true, warning, config: publicView(b) });
}

/**
 * Acciones: `?action=run` genera una copia ahora; `?action=test&target=dropbox|sftp`
 * prueba las credenciales de un destino listando lo que ya hay.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "run") {
    const res = await ejecutarBackup("manual");
    const status = res.ok ? 200 : 502;
    return NextResponse.json({ ok: res.ok, resultado: res }, { status });
  }

  if (action === "test") {
    const target = url.searchParams.get("target");
    if (target !== "dropbox" && target !== "sftp") {
      return NextResponse.json({ ok: false, error: "Destino de prueba desconocido." }, { status: 400 });
    }
    const res = await probarDestino(target);
    return NextResponse.json(res, { status: res.ok ? 200 : 502 });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
