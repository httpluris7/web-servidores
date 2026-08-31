import { setRequestLocale } from "next-intl/server";
import { maskSecret, readSettings } from "@/lib/ajustes";
import { leerHistorial, listarLocales } from "@/lib/backup/run";
import { BackupSettingsForm } from "@/components/admin/BackupSettingsForm";

export const dynamic = "force-dynamic";

export default async function BackupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Al cliente solo viaja la versión enmascarada: los secretos no salen de aquí.
  const { backup: b } = await readSettings();
  const [historial, locales] = await Promise.all([leerHistorial(30), listarLocales()]);

  const initial = {
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

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Copias de seguridad</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Copias cifradas de los datos y secretos del servicio, con envío a Dropbox/SFTP y
          restauración en otro servidor con un solo comando.
        </p>
      </header>

      <BackupSettingsForm initial={initial} historial={historial} locales={locales} />
    </div>
  );
}
