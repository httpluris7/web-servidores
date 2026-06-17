import { spawn } from "node:child_process";

/**
 * Envío de avisos por correo a través del Postfix local (sin dependencias
 * externas: usamos el binario `sendmail` del sistema). El servidor firma con
 * DKIM (d=viahost.top) en la salida, así que usamos un remitente del propio
 * dominio para que SPF/DKIM/DMARC aliñen.
 */

const SENDMAIL = "/usr/sbin/sendmail";

/**
 * Remitente del sobre. Dirección dedicada del propio dominio (no es buzón de
 * login), para alinear DMARC y para que rspamd pueda eximir del filtro estos
 * avisos internos sin afectar al correo de los usuarios reales. Ver la regla
 * en /etc/rspamd/local.d/settings.conf (acotada a este from + IP local).
 */
const FROM = "web@viahost.top";

/** Enrutado del tema del formulario al buzón destino. */
const TOPIC_TO_MAILBOX: Record<string, string> = {
  ventas: "ventas@viahost.top",
  soporte: "soporte@viahost.top",
  abuse: "abuse@viahost.top",
  otro: "administrador@viahost.top",
};

const FALLBACK_MAILBOX = "administrador@viahost.top";

/** Elimina CR/LF de un valor que va en una cabecera (evita header injection). */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Codifica una cabecera en RFC 2047 si contiene caracteres no ASCII. */
function encodeHeader(value: string): string {
  const safe = headerSafe(value);
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(safe)) return safe;
  return `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

export type ContactLead = {
  name: string;
  email: string;
  message: string;
  topic: string;
};

/**
 * Envía el aviso del formulario de contacto al buzón correspondiente al tema.
 * Best-effort: si el envío falla, lanza para que quien llama lo registre, pero
 * el lead ya quedó persistido en disco por `saveLead`.
 */
export async function sendContactMail(lead: ContactLead): Promise<void> {
  const to = TOPIC_TO_MAILBOX[lead.topic] ?? FALLBACK_MAILBOX;
  const replyTo = headerSafe(lead.email);
  const subject = encodeHeader(`[Contacto web · ${lead.topic}] ${lead.name}`);

  const headers = [
    `From: Formulario web viahost <${FROM}>`,
    `To: ${to}`,
    `Reply-To: ${encodeHeader(lead.name)} <${replyTo}>`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ].join("\r\n");

  const body = [
    "Nuevo mensaje desde el formulario de contacto de viahost.top",
    "",
    `Tema:    ${lead.topic}`,
    `Nombre:  ${lead.name}`,
    `Email:   ${lead.email}`,
    "",
    "Mensaje:",
    lead.message,
    "",
    "—",
    "Puedes responder directamente a este correo para contestar al remitente.",
  ].join("\n");

  const message = `${headers}\r\n\r\n${body}\n`;

  await new Promise<void>((resolve, reject) => {
    // -i: no tratar una línea con solo "." como fin de entrada.
    // -f: fija el remitente del sobre (SPF).
    const child = spawn(SENDMAIL, ["-i", "-f", FROM, to], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sendmail exited with code ${code}: ${stderr.trim()}`));
    });
    child.stdin.write(message);
    child.stdin.end();
  });
}
