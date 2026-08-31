"use client";

import { useState } from "react";

/**
 * Panel de copias de seguridad. Los textos van en español (backoffice interno)
 * en vez de por i18n: es la única sección así, a cambio de no triplicar ~60
 * cadenas en en/es/fr para una pantalla que solo ve administración.
 *
 * Los secretos (frase de cifrado, token de Dropbox, clave SFTP) NUNCA llegan
 * aquí: el servidor manda solo si están puestos y una versión enmascarada. Un
 * campo de secreto en blanco significa "no lo toques"; para borrarlo hay botón
 * aparte que envía `null`.
 */

type Config = {
  enabled: boolean;
  hour: number;
  retain: number;
  keepLocal: boolean;
  hasPassphrase: boolean;
  dropboxEnabled: boolean;
  sftpEnabled: boolean;
  dropbox: {
    folder: string;
    appKey: string;
    hasAccessToken: boolean;
    accessTokenMask: string;
    hasRefreshToken: boolean;
    refreshTokenMask: string;
    hasAppSecret: boolean;
  };
  sftp: { host: string; port: number; user: string; dir: string; hasPrivateKey: boolean };
};

type Destinos = Partial<Record<"local" | "dropbox" | "sftp", { ok: boolean; error?: string }>>;
type Entrada = {
  t: string;
  nombre: string;
  bytes: number;
  origen: "manual" | "programado";
  destinos: Destinos;
  ok: boolean;
  error?: string;
};
type Local = { nombre: string; bytes: number; mtime: string };

const campo =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none md:min-h-0";
const boton =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] px-4 text-sm font-medium transition-colors disabled:opacity-50 md:min-h-0 md:py-2";
const botonPrim = `${boton} bg-[var(--color-accent)] text-black hover:opacity-90`;
const botonSec = `${boton} border border-[var(--color-line-strong)] text-[var(--color-fg)] hover:bg-white/5`;
const tarjeta =
  "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 md:p-6";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function BackupSettingsForm({
  initial,
  historial,
  locales,
}: {
  initial: Config;
  historial: Entrada[];
  locales: Local[];
}) {
  const [cfg, setCfg] = useState<Config>(initial);
  const [hist, setHist] = useState<Entrada[]>(historial);
  const [locs, setLocs] = useState<Local[]>(locales);
  // Los secretos son campos aparte: solo se envían si el usuario escribe algo.
  const [passphrase, setPassphrase] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [privateKey, setPrivateKey] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [probando, setProbando] = useState<"dropbox" | "sftp" | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error" | "aviso"; texto: string } | null>(null);

  function set<K extends keyof Config>(k: K, v: Config[K]) {
    setCfg((p) => ({ ...p, [k]: v }));
    setMsg(null);
  }
  function setDbx<K extends keyof Config["dropbox"]>(k: K, v: Config["dropbox"][K]) {
    setCfg((p) => ({ ...p, dropbox: { ...p.dropbox, [k]: v } }));
    setMsg(null);
  }
  function setSftp<K extends keyof Config["sftp"]>(k: K, v: Config["sftp"][K]) {
    setCfg((p) => ({ ...p, sftp: { ...p.sftp, [k]: v } }));
    setMsg(null);
  }

  async function refrescar() {
    const res = await fetch("/api/admin/backups");
    const json = await res.json().catch(() => null);
    if (json?.ok) {
      setCfg(json.config);
      setHist(json.historial);
      setLocs(json.locales);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        enabled: cfg.enabled,
        hour: cfg.hour,
        retain: cfg.retain,
        keepLocal: cfg.keepLocal,
        dropboxEnabled: cfg.dropboxEnabled,
        sftpEnabled: cfg.sftpEnabled,
        dropbox: {
          folder: cfg.dropbox.folder,
          appKey: cfg.dropbox.appKey,
          ...(accessToken ? { accessToken } : {}),
          ...(refreshToken ? { refreshToken } : {}),
          ...(appSecret ? { appSecret } : {}),
        },
        sftp: {
          host: cfg.sftp.host,
          port: cfg.sftp.port,
          user: cfg.sftp.user,
          dir: cfg.sftp.dir,
          ...(privateKey ? { privateKey } : {}),
        },
      };
      if (passphrase) body.passphrase = passphrase;
      const res = await fetch("/api/admin/backups", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setMsg({ tipo: "error", texto: json?.error ?? "No se pudo guardar." });
        return;
      }
      setCfg(json.config);
      setPassphrase("");
      setAccessToken("");
      setRefreshToken("");
      setAppSecret("");
      setPrivateKey("");
      setMsg(
        json.warning ? { tipo: "aviso", texto: json.warning } : { tipo: "ok", texto: "Guardado." }
      );
    } catch {
      setMsg({ tipo: "error", texto: "Error de conexión." });
    } finally {
      setGuardando(false);
    }
  }

  async function borrarSecreto(campo: "passphrase" | "accessToken" | "refreshToken" | "appSecret" | "privateKey") {
    setGuardando(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> =
        campo === "passphrase"
          ? { passphrase: null }
          : campo === "privateKey"
            ? { sftp: { privateKey: null } }
            : { dropbox: { [campo]: null } };
      const res = await fetch("/api/admin/backups", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (json?.ok) {
        setCfg(json.config);
        setMsg({ tipo: "ok", texto: "Secreto borrado." });
      }
    } finally {
      setGuardando(false);
    }
  }

  async function copiaAhora() {
    setCopiando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/backups?action=run", { method: "POST" });
      const json = await res.json().catch(() => null);
      const r = json?.resultado;
      if (json?.ok) {
        const enviados = Object.entries((r?.destinos ?? {}) as Destinos)
          .filter(([, d]) => d?.ok)
          .map(([k]) => k)
          .join(", ");
        setMsg({ tipo: "ok", texto: `Copia hecha (${fmtBytes(r?.bytes ?? 0)}) → ${enviados || "sin destino"}.` });
      } else {
        setMsg({ tipo: "error", texto: r?.error || "La copia falló en todos los destinos." });
      }
      await refrescar();
    } catch {
      setMsg({ tipo: "error", texto: "Error de conexión." });
    } finally {
      setCopiando(false);
    }
  }

  async function probar(target: "dropbox" | "sftp") {
    setProbando(target);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/backups?action=test&target=${target}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (json?.ok) {
        setMsg({ tipo: "ok", texto: `${target}: conexión correcta (${json.copias ?? 0} copias ya guardadas).` });
      } else {
        setMsg({ tipo: "error", texto: `${target}: ${json?.error ?? "no se pudo conectar."}` });
      }
    } catch {
      setMsg({ tipo: "error", texto: "Error de conexión." });
    } finally {
      setProbando(null);
    }
  }

  const ultima = hist.find((e) => e.ok);

  return (
    <div className="grid gap-6">
      {msg && (
        <p
          className={
            "rounded-[var(--radius-md)] px-4 py-3 text-sm " +
            (msg.tipo === "ok"
              ? "bg-emerald-500/10 text-emerald-300"
              : msg.tipo === "aviso"
                ? "bg-amber-500/10 text-amber-300"
                : "bg-red-500/10 text-red-300")
          }
        >
          {msg.texto}
        </p>
      )}

      {/* Estado + acción rápida */}
      <section className={tarjeta}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Estado</h2>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              {ultima
                ? `Última copia correcta: ${fmtFecha(ultima.t)} (${fmtBytes(ultima.bytes)}).`
                : "Todavía no hay ninguna copia correcta."}
            </p>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              Programación:{" "}
              {cfg.enabled ? (
                <span className="text-emerald-300">
                  activa, a las {String(cfg.hour).padStart(2, "0")}:00
                </span>
              ) : (
                <span className="text-[var(--color-fg-dim)]">desactivada</span>
              )}
              {" · "}
              conservando {cfg.retain === 0 ? "todas" : cfg.retain} copias.
            </p>
          </div>
          <button type="button" onClick={copiaAhora} disabled={copiando} className={botonPrim}>
            {copiando ? "Generando…" : "Copia ahora"}
          </button>
        </div>
      </section>

      {/* Configuración general */}
      <form onSubmit={guardar} className="grid gap-6">
        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">Programación y cifrado</h2>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Cada copia lleva <code>data/</code> y el <code>.env</code>, cifrados con AES-256 antes
            de salir. Con la frase de cifrado, el repo (git) y{" "}
            <code>node scripts/restaurar.mjs</code> se revive el servicio en otro servidor.
          </p>

          <div className="mt-5 grid gap-5">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              <span className="text-sm">Generar una copia automática cada día</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">Hora diaria (0-23)</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={cfg.hour}
                  onChange={(e) => set("hour", Number(e.target.value))}
                  className={campo}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">Copias a conservar (0 = todas)</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={cfg.retain}
                  onChange={(e) => set("retain", Number(e.target.value))}
                  className={campo}
                />
              </label>
              <label className="flex items-end gap-3 pb-2">
                <input
                  type="checkbox"
                  checked={cfg.keepLocal}
                  onChange={(e) => set("keepLocal", e.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                <span className="text-sm">Guardar copia local en el servidor</span>
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-sm text-[var(--color-fg-muted)]">
                Frase de cifrado{" "}
                {cfg.hasPassphrase ? (
                  <span className="text-emerald-300">· guardada</span>
                ) : (
                  <span className="text-amber-300">· sin configurar</span>
                )}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={cfg.hasPassphrase ? "•••••••• (deja en blanco para no cambiarla)" : "Elige una frase larga y guárdala aparte"}
                className={campo}
              />
              <span className="text-xs text-[var(--color-fg-dim)]">
                Apúntala en un gestor de contraseñas: si se pierde, los backups son
                irrecuperables. Se pide al restaurar en otro servidor.
              </span>
            </label>
          </div>
        </section>

        {/* Dropbox */}
        <section className={tarjeta}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Dropbox</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.dropboxEnabled}
                onChange={(e) => set("dropboxEnabled", e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              Activo
            </label>
          </div>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Recomendado: app con <em>refresh token</em> (no caduca) + App key/secret. También vale
            un token de acceso directo, pero caduca a las 4 h.
          </p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm text-[var(--color-fg-muted)]">Carpeta destino</span>
              <input value={cfg.dropbox.folder} onChange={(e) => setDbx("folder", e.target.value)} placeholder="/viahost-backups" className={campo} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">App key</span>
                <input value={cfg.dropbox.appKey} onChange={(e) => setDbx("appKey", e.target.value)} className={campo} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">
                  App secret {cfg.dropbox.hasAppSecret && <span className="text-emerald-300">· guardado</span>}
                </span>
                <input type="password" autoComplete="off" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={cfg.dropbox.hasAppSecret ? "•••• (sin cambios)" : ""} className={campo} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">
                  Refresh token {cfg.dropbox.hasRefreshToken && <span className="text-emerald-300">· {cfg.dropbox.refreshTokenMask}</span>}
                </span>
                <input type="password" autoComplete="off" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} placeholder={cfg.dropbox.hasRefreshToken ? "•••• (sin cambios)" : ""} className={campo} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">
                  Token de acceso (alternativa) {cfg.dropbox.hasAccessToken && <span className="text-emerald-300">· {cfg.dropbox.accessTokenMask}</span>}
                </span>
                <input type="password" autoComplete="off" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={cfg.dropbox.hasAccessToken ? "•••• (sin cambios)" : ""} className={campo} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => probar("dropbox")} disabled={probando === "dropbox"} className={botonSec}>
                {probando === "dropbox" ? "Probando…" : "Probar Dropbox"}
              </button>
            </div>
          </div>
        </section>

        {/* SFTP */}
        <section className={tarjeta}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">SFTP</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.sftpEnabled}
                onChange={(e) => set("sftpEnabled", e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              Activo
            </label>
          </div>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Envío por <code>scp</code> con clave SSH. Pega la clave privada (PEM); se usa solo en
            memoria y se escribe a un fichero temporal 0600 al conectar.
          </p>
          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">Host</span>
                <input value={cfg.sftp.host} onChange={(e) => setSftp("host", e.target.value)} placeholder="backup.ejemplo.com" className={campo} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">Puerto</span>
                <input type="number" min={1} max={65535} value={cfg.sftp.port} onChange={(e) => setSftp("port", Number(e.target.value))} className={campo} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">Usuario</span>
                <input value={cfg.sftp.user} onChange={(e) => setSftp("user", e.target.value)} className={campo} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-[var(--color-fg-muted)]">Carpeta destino</span>
                <input value={cfg.sftp.dir} onChange={(e) => setSftp("dir", e.target.value)} placeholder="viahost-backups" className={campo} />
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm text-[var(--color-fg-muted)]">
                Clave privada SSH (PEM) {cfg.sftp.hasPrivateKey && <span className="text-emerald-300">· guardada</span>}
              </span>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                rows={4}
                autoComplete="off"
                placeholder={cfg.sftp.hasPrivateKey ? "•••• (deja en blanco para no cambiarla)" : "-----BEGIN OPENSSH PRIVATE KEY-----\n…"}
                className={`${campo} font-mono text-xs`}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => probar("sftp")} disabled={probando === "sftp"} className={botonSec}>
                {probando === "sftp" ? "Probando…" : "Probar SFTP"}
              </button>
              {cfg.sftp.hasPrivateKey && (
                <button type="button" onClick={() => borrarSecreto("privateKey")} disabled={guardando} className={botonSec}>
                  Borrar clave
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={guardando} className={botonPrim}>
            {guardando ? "Guardando…" : "Guardar configuración"}
          </button>
          {cfg.hasPassphrase && (
            <button type="button" onClick={() => borrarSecreto("passphrase")} disabled={guardando} className={botonSec}>
              Borrar frase de cifrado
            </button>
          )}
        </div>
      </form>

      {/* Copias locales descargables */}
      {locs.length > 0 && (
        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">Copias locales</h2>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Descárgalas para guardarlas fuera del servidor (la regla 3-2-1). Van cifradas.
          </p>
          <ul className="mt-4 divide-y divide-[var(--color-line)]">
            {locs.map((l) => (
              <li key={l.nombre} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="font-mono text-xs text-[var(--color-fg-muted)]">{l.nombre}</span>
                <span className="flex items-center gap-4 text-xs text-[var(--color-fg-dim)]">
                  {fmtBytes(l.bytes)} · {fmtFecha(l.mtime)}
                  <a
                    href={`/api/admin/backups/descargar?nombre=${encodeURIComponent(l.nombre)}`}
                    className="text-[var(--color-accent)] hover:underline"
                  >
                    Descargar
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Histórico */}
      <section className={tarjeta}>
        <h2 className="text-lg font-semibold">Histórico</h2>
        {hist.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">Todavía no se ha ejecutado ninguna copia.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-fg-dim)]">
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Origen</th>
                  <th className="pb-2 pr-4 font-medium">Tamaño</th>
                  <th className="pb-2 pr-4 font-medium">Destinos</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {hist.map((e, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 text-[var(--color-fg-muted)]">{fmtFecha(e.t)}</td>
                    <td className="py-2 pr-4 text-[var(--color-fg-dim)]">{e.origen}</td>
                    <td className="py-2 pr-4 text-[var(--color-fg-dim)]">{e.bytes ? fmtBytes(e.bytes) : "—"}</td>
                    <td className="py-2 pr-4">
                      {Object.entries(e.destinos).length === 0 ? (
                        <span className="text-[var(--color-fg-dim)]">—</span>
                      ) : (
                        Object.entries(e.destinos).map(([k, d]) => (
                          <span
                            key={k}
                            title={d?.error}
                            className={"mr-2 inline-block " + (d?.ok ? "text-emerald-300" : "text-red-300")}
                          >
                            {d?.ok ? "✓" : "✗"} {k}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="py-2">
                      {e.ok ? (
                        <span className="text-emerald-300">OK</span>
                      ) : (
                        <span className="text-red-300" title={e.error}>Fallo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cómo restaurar */}
      <section className={tarjeta}>
        <h2 className="text-lg font-semibold">Cómo restaurar en otro servidor</h2>
        <ol className="mt-3 grid gap-2 text-sm text-[var(--color-fg-muted)]">
          <li>1. Clona el repositorio y entra en la carpeta.</li>
          <li>2. Ejecuta el restaurador con la última copia (local, Dropbox o SFTP):</li>
        </ol>
        <pre className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-3 text-xs">
{`# desde un fichero .vhbk descargado:
node scripts/restaurar.mjs ./viahost-backup-XXXX.vhbk --passphrase '••••'

# o tirando de la última copia en Dropbox:
node scripts/restaurar.mjs --dropbox --dropbox-refresh R --dropbox-key K --dropbox-secret S

# o del SFTP:
node scripts/restaurar.mjs --sftp --sftp-host H --sftp-user U --sftp-key ./id_backup

# después:
npm ci && npm run deploy`}
        </pre>
        <p className="mt-3 text-xs text-[var(--color-fg-dim)]">
          El restaurador repone <code>data/</code> y <code>.env</code>. La frase de cifrado se pide
          si no se pasa por <code>--passphrase</code> o <code>BACKUP_PASSPHRASE</code>.
        </p>
      </section>
    </div>
  );
}
