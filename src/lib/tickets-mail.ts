import { createHash } from "node:crypto";
import { open, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { ingestTicketMessages, listTickets, type IngestedMessage } from "@/lib/tickets";

/**
 * Ingesta del buzón de soporte hacia los hilos de los tickets.
 *
 * El correo es el canal real: los tickets se atienden respondiendo desde
 * soporte@viahost.top (ver `lib/mail.ts`). Sin esto, esas respuestas solo
 * existirían en el buzón del cliente y el hilo de la web se quedaría cojo.
 *
 * Se lee el Maildir directamente del disco, no por IMAP: el buzón está en esta
 * misma máquina, la app corre como root y así no hacen falta ni credenciales ni
 * una dependencia nueva —el mismo criterio por el que enviamos con el binario
 * `sendmail` en vez de hablar SMTP—. La lectura es de SOLO LECTURA: no se marca,
 * ni se mueve, ni se borra nada; la deduplicación va por `Message-ID` guardado
 * en el propio hilo.
 *
 * Se miran dos carpetas:
 *  - INBOX: lo que escribe el cliente respondiendo por correo → autor "cliente".
 *  - Sent:  lo que contestamos desde Roundcube → autor "soporte".
 */

/** Raíz del Maildir del buzón. Configurable para poder probar contra una copia. */
const MAILDIR = process.env.TICKETS_MAILDIR || "/var/mail/vhosts/viahost.top/soporte";

/** Remitente de nuestros propios avisos: sus correos NO se ingestan. */
const REMITENTE_PROPIO = "web@viahost.top";

/** Dominio de los buzones del equipo: cualquier otro remitente nuestro es soporte. */
const DOMINIO_PROPIO = "@viahost.top";

/** Ventana de correo que se mira, en días. Más atrás no se vuelve a leer. */
const DIAS = Number(process.env.TICKETS_MAILDIR_DIAS || 30);

/** Tope de ficheros por pasada, del más reciente al más antiguo. */
const MAX_FICHEROS = 400;

/** Cuánto se lee de cada fichero: cabeceras + parte de texto, sin adjuntos. */
const MAX_BYTES = 512 * 1024;

/** Tope del cuerpo que se guarda, igual que en los mensajes escritos en la web. */
const MAX_CUERPO = 5000;

/** Cada cuánto puede repetirse la ingesta, como mucho. */
const INTERVALO_MS = 15_000;

/* ------------------------------ Parseo de MIME ---------------------------- */

type Correo = {
  headers: Map<string, string>;
  cuerpo: string;
};

/** Desdobla las cabeceras (las continuaciones empiezan por espacio o tabulador). */
function parseHeaders(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  const lineas = raw.split(/\r?\n/);
  let actual = "";
  const guardar = () => {
    const i = actual.indexOf(":");
    if (i > 0) {
      const nombre = actual.slice(0, i).trim().toLowerCase();
      // Nos quedamos con la primera aparición: si un correo trae dos veces la
      // misma cabecera, la de arriba es la que aplicó el servidor.
      if (!out.has(nombre)) out.set(nombre, actual.slice(i + 1).trim());
    }
    actual = "";
  };
  for (const linea of lineas) {
    if (/^[ \t]/.test(linea) && actual) actual += " " + linea.trim();
    else {
      guardar();
      actual = linea;
    }
  }
  guardar();
  return out;
}

/** Decodifica encoded-words RFC 2047 (`=?UTF-8?B?...?=`) dentro de una cabecera. */
function decodeWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, tipo, texto) => {
    try {
      const buf =
        tipo.toUpperCase() === "B"
          ? Buffer.from(texto, "base64")
          : Buffer.from(texto.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m: string, h: string) =>
              String.fromCharCode(parseInt(h, 16))
            ), "binary");
      return decodeCharset(buf, String(charset));
    } catch {
      return texto;
    }
  });
}

function decodeCharset(buf: Buffer, charset: string): string {
  const c = charset.toLowerCase();
  if (c.includes("8859") || c.includes("1252") || c.includes("ascii")) return buf.toString("latin1");
  return buf.toString("utf8");
}

function decodeTransfer(texto: string, encoding: string, charset: string): string {
  const enc = encoding.toLowerCase();
  if (enc === "base64") {
    return decodeCharset(Buffer.from(texto.replace(/\s+/g, ""), "base64"), charset);
  }
  if (enc === "quoted-printable") {
    const sinCortes = texto.replace(/=\r?\n/g, "");
    const bytes: number[] = [];
    for (let i = 0; i < sinCortes.length; i++) {
      if (sinCortes[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(sinCortes.slice(i + 1, i + 3))) {
        bytes.push(parseInt(sinCortes.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(sinCortes.charCodeAt(i) & 0xff);
      }
    }
    return decodeCharset(Buffer.from(bytes), charset);
  }
  // 7bit/8bit/binary: el fichero se leyó como latin1 para no romper bytes.
  return decodeCharset(Buffer.from(texto, "latin1"), charset);
}

function parametro(valor: string, nombre: string): string {
  const m = new RegExp(`${nombre}\\s*=\\s*"([^"]*)"|${nombre}\\s*=\\s*([^;\\s]+)`, "i").exec(valor);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

/** Convierte a texto un cuerpo HTML, para cuando el correo no trae parte plana. */
function htmlATexto(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Devuelve el texto del correo. En un multipart baja hasta la primera parte
 * `text/plain` (una respuesta de Roundcube en modo HTML es multipart/alternative
 * con texto y HTML). Si no hay parte plana, se recurre al HTML convertido antes
 * que perder lo que escribió la persona.
 */
function textoPlano(headers: Map<string, string>, cuerpo: string, profundidad = 0): string {
  const contentType = headers.get("content-type") ?? "text/plain";
  const charset = parametro(contentType, "charset") || "utf-8";

  if (/^multipart\//i.test(contentType)) {
    if (profundidad > 3) return "";
    const boundary = parametro(contentType, "boundary");
    if (!boundary) return "";
    let alternativa = "";
    for (const parte of cuerpo.split(`--${boundary}`)) {
      const limpio = parte.replace(/^\r?\n/, "");
      if (!limpio.trim() || limpio.startsWith("--")) continue;
      const corte = limpio.search(/\r?\n\r?\n/);
      if (corte < 0) continue;
      const sub = parseHeaders(limpio.slice(0, corte));
      const subTipo = sub.get("content-type") ?? "text/plain";
      const subCuerpo = limpio.slice(corte).replace(/^\r?\n\r?\n/, "");
      const decodificar = () =>
        decodeTransfer(
          subCuerpo,
          sub.get("content-transfer-encoding") ?? "7bit",
          parametro(subTipo, "charset") || "utf-8"
        );

      if (/^text\/plain/i.test(subTipo)) return decodificar();
      if (/^text\/html/i.test(subTipo) && !alternativa) alternativa = htmlATexto(decodificar());
      if (/^multipart\//i.test(subTipo)) {
        const anidado = textoPlano(sub, subCuerpo, profundidad + 1);
        if (anidado) return anidado;
      }
    }
    return alternativa;
  }

  const texto = decodeTransfer(cuerpo, headers.get("content-transfer-encoding") ?? "7bit", charset);
  if (/^text\/plain/i.test(contentType)) return texto;
  if (/^text\/html/i.test(contentType)) return htmlATexto(texto);
  return "";
}

/**
 * Quita del cuerpo la cita del mensaje anterior.
 *
 * Los clientes de correo añaden el original entero debajo de la respuesta. Sin
 * esto, cada mensaje del hilo repetiría todos los anteriores. Se corta por el
 * primer separador conocido y se limpian las líneas citadas del final; si el
 * resultado se queda en nada, se devuelve el cuerpo entero (mejor de más que
 * perder lo que escribió la persona).
 */
function quitarCita(texto: string): string {
  const lineas = texto.replace(/\r\n/g, "\n").split("\n");
  const separador =
    /^\s*(-{2,}\s*(original message|mensaje original|message d'origine)|_{5,})|(el|on|le)\s+.{4,}\s+(escribió|escribio|wrote|a écrit|a ecrit)\s*:?\s*$/i;

  let fin = lineas.length;
  for (let i = 0; i < lineas.length; i++) {
    if (separador.test(lineas[i] ?? "")) {
      fin = i;
      break;
    }
  }

  const cuerpo = lineas.slice(0, fin);
  for (let ultima = cuerpo[cuerpo.length - 1]; ultima !== undefined; ultima = cuerpo[cuerpo.length - 1]) {
    if (!/^\s*>/.test(ultima) && ultima.trim()) break;
    cuerpo.pop();
  }
  const limpio = cuerpo.join("\n").trim();
  return limpio.length >= 2 ? limpio : texto.trim();
}

/** Dirección de una cabecera `Nombre <dir@dominio>` o `dir@dominio`. */
function direccion(valor: string): string {
  const m = /<([^>]+)>/.exec(valor);
  return (m?.[1] ?? valor).trim().toLowerCase();
}

/* ------------------------------- Recorrido -------------------------------- */

async function ficherosRecientes(dirs: string[]): Promise<{ file: string; mtime: number }[]> {
  const desde = Date.now() - DIAS * 24 * 60 * 60_000;
  const out: { file: string; mtime: number }[] = [];
  for (const dir of dirs) {
    let entradas: string[];
    try {
      entradas = await readdir(dir);
    } catch {
      continue; // La carpeta puede no existir (p. ej. Sent sin estrenar).
    }
    for (const nombre of entradas) {
      if (nombre.startsWith(".")) continue;
      const file = path.join(dir, nombre);
      try {
        const s = await stat(file);
        if (!s.isFile() || s.mtimeMs < desde) continue;
        out.push({ file, mtime: s.mtimeMs });
      } catch {
        // Dovecot renombra ficheros al vuelo: si desaparece, a otra cosa.
      }
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, MAX_FICHEROS);
}

async function leerCorreo(file: string): Promise<Correo | null> {
  let fh;
  try {
    fh = await open(file, "r");
    const buf = Buffer.alloc(MAX_BYTES);
    const { bytesRead } = await fh.read(buf, 0, MAX_BYTES, 0);
    // latin1 conserva los bytes uno a uno; cada parte se decodifica luego con
    // su propio charset, que es lo único que sabe cómo interpretarlos.
    const raw = buf.subarray(0, bytesRead).toString("latin1");
    const corte = raw.search(/\r?\n\r?\n/);
    if (corte < 0) return null;
    return {
      headers: parseHeaders(raw.slice(0, corte)),
      cuerpo: raw.slice(corte).replace(/^\r?\n\r?\n/, ""),
    };
  } catch {
    return null;
  } finally {
    await fh?.close().catch(() => {});
  }
}

/** Número de ticket al que pertenece un correo, mirando por orden de fiabilidad. */
function numeroDeTicket(headers: Map<string, string>): string | null {
  const propia = headers.get("x-viahost-ticket");
  if (propia && /^TCK-\d{4}-\d{3}$/i.test(propia.trim())) return propia.trim().toUpperCase();

  // Nuestros avisos llevan Message-ID derivado del número, así que la respuesta
  // lo arrastra en In-Reply-To/References aunque el asunto se haya reescrito.
  const refs = `${headers.get("in-reply-to") ?? ""} ${headers.get("references") ?? ""}`;
  const porRef = /<(tck-\d{4}-\d{3})-\d+@viahost\.top>/i.exec(refs);
  if (porRef?.[1]) return porRef[1].toUpperCase();

  const asunto = decodeWords(headers.get("subject") ?? "");
  const porAsunto = /\[(TCK-\d{4}-\d{3})\]/i.exec(asunto);
  return porAsunto?.[1] ? porAsunto[1].toUpperCase() : null;
}

/* -------------------------------- Ingesta --------------------------------- */

let ultimaSync = 0;
let enCurso: Promise<number> | null = null;

/**
 * Lee el buzón e incorpora al hilo lo que no estuviera ya. Devuelve cuántos
 * mensajes se añadieron.
 *
 * Se llama al pintar las pantallas de tickets, así que va limitada en el tiempo
 * (una pasada cada 15 s como mucho) y nunca lanza: si el buzón no se puede
 * leer, las pantallas se pintan igual con lo que haya en el hilo.
 */
export async function syncTicketMail(opts: { force?: boolean } = {}): Promise<number> {
  if (enCurso) return enCurso;
  if (!opts.force && Date.now() - ultimaSync < INTERVALO_MS) return 0;
  ultimaSync = Date.now();
  enCurso = ejecutar().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function ejecutar(): Promise<number> {
  try {
    const tickets = await listTickets();
    if (tickets.length === 0) return 0;
    const porNumero = new Map(tickets.map((t) => [t.numero, t]));
    // Los Message-ID ya incorporados: evita releer y re-guardar lo mismo.
    const conocidos = new Set(
      tickets.flatMap((t) => t.mensajes.map((m) => m.mailMessageId).filter(Boolean) as string[])
    );

    const entrantes = await ficherosRecientes([
      path.join(MAILDIR, "new"),
      path.join(MAILDIR, "cur"),
    ]);
    const salientes = await ficherosRecientes([
      path.join(MAILDIR, ".Sent", "new"),
      path.join(MAILDIR, ".Sent", "cur"),
    ]);

    const nuevos: IngestedMessage[] = [];

    for (const { file, mtime, saliente } of [
      ...entrantes.map((f) => ({ ...f, saliente: false })),
      ...salientes.map((f) => ({ ...f, saliente: true })),
    ]) {
      const correo = await leerCorreo(file);
      if (!correo) continue;

      const numero = numeroDeTicket(correo.headers);
      if (!numero) continue;
      const ticket = porNumero.get(numero);
      if (!ticket) continue;

      const messageId = (correo.headers.get("message-id") ?? "").trim();
      // Nuestros propios avisos: ya están en el hilo por haberlos escrito allí.
      if (/^<tck-\d{4}-\d{3}-\d+@viahost\.top>$/i.test(messageId)) continue;

      const de = direccion(correo.headers.get("from") ?? "");
      if (!de || de === REMITENTE_PROPIO) continue;

      // Lo que rspamd marcó como spam no entra en el hilo. El `From` de un
      // correo se falsifica con facilidad y aquí basta con acertar el número
      // del ticket y la dirección del cliente para colar un mensaje a su
      // nombre; el filtro de entrada es la única barrera que tenemos.
      const spam = `${correo.headers.get("x-spam") ?? ""} ${correo.headers.get("x-spam-flag") ?? ""}`;
      if (/\b(yes|true)\b/i.test(spam)) continue;

      const autor =
        de === ticket.clienteEmail.toLowerCase()
          ? ("cliente" as const)
          : de.endsWith(DOMINIO_PROPIO)
            ? ("soporte" as const)
            : null;
      if (!autor) continue;
      // Un correo de la carpeta de enviados escrito por el cliente no existe:
      // si el remitente no es nuestro, algo no cuadra y se deja fuera.
      if (saliente && autor !== "soporte") continue;

      const clave =
        messageId ||
        `sha256:${createHash("sha256").update(`${file}:${mtime}`).digest("hex").slice(0, 32)}`;
      if (conocidos.has(clave) || nuevos.some((n) => n.mailMessageId === clave)) continue;

      const texto = textoPlano(correo.headers, correo.cuerpo);
      const cuerpo = quitarCita(texto).slice(0, MAX_CUERPO);
      if (cuerpo.length < 2) continue;

      const fecha = new Date(correo.headers.get("date") ?? "");
      nuevos.push({
        numero,
        autor,
        nombre: de,
        cuerpo,
        creadoAt: (Number.isNaN(fecha.getTime()) ? new Date(mtime) : fecha).toISOString(),
        mailMessageId: clave,
      });
    }

    if (nuevos.length === 0) return 0;
    const añadidos = await ingestTicketMessages(nuevos);
    if (añadidos > 0) console.info(`[tickets] ${añadidos} mensaje(s) incorporados desde el buzón`);
    return añadidos;
  } catch (err) {
    console.error("[tickets] fallo leyendo el buzón de soporte", err);
    return 0;
  }
}
