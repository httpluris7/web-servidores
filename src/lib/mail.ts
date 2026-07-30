import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { emailRe } from "@/lib/leads";
import { BANK_LABEL_EN, bankReferenceNoteEn, bankRows } from "@/lib/bank";

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

/** Buzón que recibe las respuestas a las facturas enviadas a clientes. */
const BILLING_REPLY_TO = "soporte@viahost.top";

/** Buzón donde se atienden los tickets del área de cliente. */
const TICKETS_MAILBOX = "soporte@viahost.top";

/** Elimina CR/LF de un valor que va en una cabecera (evita header injection). */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Canaliza un mensaje ya montado hacia el `sendmail` local. */
function pipeSendmail(to: string, message: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // -i: no tratar una línea con solo "." como fin de entrada.
    // -f: fija el remitente del sobre (SPF).
    // --: fin de opciones; evita que un destinatario que empiece por "-" se
    //     interprete como flag de sendmail (argv flag smuggling).
    const child = spawn(SENDMAIL, ["-i", "-f", FROM, "--", to], {
      stdio: ["pipe", "ignore", "pipe"],
    });
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

/** Codifica una cabecera en RFC 2047 si contiene caracteres no ASCII. */
function encodeHeader(value: string): string {
  const safe = headerSafe(value);
  if (/^[\x20-\x7E]*$/.test(safe)) return safe;
  return `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

/**
 * Display-name seguro para cabeceras de dirección (`Nombre <email>`).
 *
 * Sin entrecomillar, un nombre con `<`, `>` o `,` puede inyectar direcciones
 * adicionales en la cabecera (p. ej. `x <a@b.c>, y`). Si es ASCII imprimible lo
 * devolvemos como quoted-string escapando `\` y `"` (RFC 5322); si lleva
 * caracteres no ASCII, el encoded-word RFC 2047 ya es seguro por construcción
 * (base64 no contiene esos separadores) y no debe entrecomillarse.
 */
function addressDisplayName(value: string): string {
  const safe = headerSafe(value);
  if (!/^[\x20-\x7E]*$/.test(safe)) return encodeHeader(safe);
  return `"${safe.replace(/([\\"])/g, "\\$1")}"`;
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

  // El Reply-To solo se emite si la dirección es limpia: `emailRe` admite
  // caracteres como `<`/`>` que romperían la cabecera. Si no lo es, se omite
  // (el aviso se entrega igual; solo se pierde la respuesta directa).
  const replyToSafe = emailRe.test(replyTo) && !/[<>,;"]/.test(replyTo);

  const headers = [
    `From: Formulario web viahost <${FROM}>`,
    `To: ${to}`,
    ...(replyToSafe ? [`Reply-To: ${addressDisplayName(lead.name)} <${replyTo}>`] : []),
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
  await pipeSendmail(to, message);
}

export type InvoiceMail = {
  to: string;
  clientName: string;
  numero: string;
  amountLabel: string; // p. ej. "EUR 94.38"
  dueDate: string; // ya formateada
  status: string; // en inglés
  isProforma: boolean; // proforma (sin pagar) vs factura final (pagada)
  payUrl?: string | null; // enlace de pago con tarjeta, si la pasarela está activa
  pdf: Buffer;
};

/**
 * Envía al cliente su proforma o su factura final con el PDF adjunto (en
 * inglés). Best-effort: si falla, lanza para que quien llama lo registre; la
 * factura ya quedó creada.
 */
export async function sendInvoiceMail(m: InvoiceMail): Promise<void> {
  const to = headerSafe(m.to);
  // Validación defensiva del destinatario (además del `--` en pipeSendmail):
  // rechaza direcciones no válidas o que empiecen por "-".
  if (!emailRe.test(to) || to.startsWith("-")) {
    throw new Error("Invalid recipient address.");
  }
  const numero = headerSafe(m.numero);
  const doc = m.isProforma ? "Proforma" : "Invoice";
  const subject = encodeHeader(
    m.isProforma
      ? `Proforma ${numero} — ViaHost Networks, LLC`
      : `Invoice ${numero} (PAID) — ViaHost Networks, LLC`
  );
  // Boundary ALEATORIO: si se derivara del nº de factura sería predecible
  // (FACT-AAAA-NNN), y un texto del propio mensaje que lo reprodujese podría
  // forjar/terminar partes MIME. Aleatorio = incolisionable e inadivinable.
  const boundary = `=_vh_${randomBytes(12).toString("hex")}_boundary_`;
  // El nombre va en el cuerpo: sin CR/LF no puede inyectar líneas ni delimitadores.
  const clientName = headerSafe(m.clientName);

  const intro = m.isProforma
    ? `Please find attached proforma ${numero} from ViaHost Networks, LLC. It is not a final invoice; once your payment is confirmed we will issue the final invoice.`
    : `Please find attached your paid invoice ${numero} from ViaHost Networks, LLC. Thank you for your payment.`;

  // Si hay pasarela, el enlace de pago va primero: es el camino más corto para
  // el cliente. La transferencia sigue disponible justo debajo.
  const cardBlock = m.isProforma && m.payUrl ? ["", "PAY BY CARD", m.payUrl] : [];

  // En la proforma van los datos de la transferencia: el número de proforma es
  // la referencia que identifica el pedido.
  const transferBlock = m.isProforma
    ? [
        ...cardBlock,
        "",
        "HOW TO PAY — BANK TRANSFER",
        ...bankRows({ amountLabel: m.amountLabel, reference: numero }).map(
          (r) => `${(BANK_LABEL_EN[r.key] + ":").padEnd(18)}${r.value}`
        ),
        "",
        bankReferenceNoteEn(numero),
      ]
    : [];

  const bodyText = [
    `Dear ${clientName},`,
    "",
    intro,
    "",
    `${doc}:   ${numero}`,
    `Amount:    ${m.amountLabel}`,
    `Due date:  ${m.dueDate}`,
    `Status:    ${m.status}`,
    ...transferBlock,
    "",
    "Thank you for your business.",
    "",
    "—",
    "ViaHost Networks, LLC",
    BILLING_REPLY_TO,
  ].join("\r\n");

  // PDF en base64, en líneas de 76 caracteres (RFC 2045).
  const b64 = m.pdf.toString("base64").replace(/(.{76})/g, "$1\r\n");

  const message = [
    `From: ViaHost Billing <${FROM}>`,
    `To: ${to}`,
    `Reply-To: ${BILLING_REPLY_TO}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    bodyText,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${numero}.pdf"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${numero}.pdf"`,
    "",
    b64,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  await pipeSendmail(to, message);
}

export type PasswordResetMail = {
  to: string;
  /** Nombre de pila, para encabezar el mensaje. */
  name: string;
  /** Enlace completo con el token. */
  url: string;
  /** Textos ya traducidos al idioma desde el que se pidió (ver el API). */
  text: {
    subject: string;
    greeting: string;
    intro: string;
    linkLabel: string;
    expiry: string;
    ignore: string;
  };
};

/**
 * Envía el enlace para restablecer la contraseña.
 *
 * El mensaje va en el idioma desde el que se pidió: quien lo recibe acaba de
 * estar en la web y espera leerlo en el mismo idioma. Los textos llegan ya
 * traducidos desde la ruta de API, que es quien tiene acceso a los diccionarios.
 *
 * El enlace se pone también en texto plano, sin acortar ni envolver, para que
 * funcione en clientes que no crean enlaces automáticamente y para que el
 * usuario pueda ver a dónde va antes de pulsarlo.
 */
export async function sendPasswordResetMail(m: PasswordResetMail): Promise<void> {
  const to = headerSafe(m.to);
  if (!emailRe.test(to) || to.startsWith("-")) {
    throw new Error("Invalid recipient address.");
  }

  const headers = [
    `From: ViaHost <${FROM}>`,
    `To: ${to}`,
    `Reply-To: ${BILLING_REPLY_TO}`,
    `Subject: ${encodeHeader(m.text.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    // Los clientes no deben responder ni archivar esto como correo comercial.
    "Auto-Submitted: auto-generated",
  ].join("\r\n");

  const body = [
    `${m.text.greeting} ${headerSafe(m.name)},`,
    "",
    m.text.intro,
    "",
    m.text.linkLabel,
    m.url,
    "",
    m.text.expiry,
    m.text.ignore,
    "",
    "—",
    "ViaHost Networks, LLC",
    BILLING_REPLY_TO,
  ].join("\r\n");

  await pipeSendmail(to, `${headers}\r\n\r\n${body}\n`);
}

/* --------------------------------- Tickets -------------------------------- */

/**
 * Identificador de mensaje del hilo de un ticket.
 *
 * Al derivarlo del número del ticket (TCK-AAAA-NNN, solo alfanumérico y
 * guiones) el cliente de correo agrupa toda la conversación en un hilo, que es
 * lo que hace usable atender los tickets desde el buzón. El índice es la
 * posición del mensaje: el primero es la raíz a la que apuntan los siguientes.
 */
function ticketMessageId(numero: string, indice: number): string {
  return `<${headerSafe(numero).toLowerCase()}-${indice}@viahost.top>`;
}

export type TicketMail = {
  numero: string;
  asunto: string;
  categoria: string;
  clienteNombre: string;
  clienteEmail: string;
  /** Etiqueta del servidor al que se refiere, si el cliente eligió uno. */
  servidor: string;
  cuerpo: string;
  /** Posición del mensaje en el hilo (1 = apertura del ticket). */
  indice: number;
  /** Enlace al ticket en el panel de administración. */
  adminUrl: string;
};

/**
 * Envía al buzón de soporte el mensaje que acaba de escribir un cliente.
 *
 * El `Reply-To` es el propio cliente: responder desde Roundcube le contesta
 * directamente, que es como se atienden los tickets. Esa respuesta se recoge
 * después de la carpeta de enviados y entra en el hilo de la web (ver
 * `lib/tickets-mail.ts`), así que las dos vías dejan el mismo rastro.
 *
 * Best-effort: si falla, lanza para que quien llama lo registre; el ticket ya
 * quedó guardado en disco y se ve en el panel.
 */
export async function sendTicketMail(m: TicketMail): Promise<void> {
  const numero = headerSafe(m.numero);
  const replyTo = headerSafe(m.clienteEmail);
  // Mismo criterio que en el formulario de contacto: el Reply-To solo se emite
  // si la dirección es limpia (`emailRe` admite `<`/`>`, que romperían la
  // cabecera). Si no lo es, el aviso se entrega igual sin respuesta directa.
  const replyToSafe = emailRe.test(replyTo) && !/[<>,;"]/.test(replyTo);

  const asunto = `[${numero}] ${m.asunto}`;
  const headers = [
    `From: Tickets viahost <${FROM}>`,
    `To: ${TICKETS_MAILBOX}`,
    ...(replyToSafe
      ? [`Reply-To: ${addressDisplayName(m.clienteNombre)} <${replyTo}>`]
      : []),
    `Subject: ${encodeHeader(m.indice > 1 ? `Re: ${asunto}` : asunto)}`,
    `Message-ID: ${ticketMessageId(numero, m.indice)}`,
    ...(m.indice > 1
      ? [
          `In-Reply-To: ${ticketMessageId(numero, 1)}`,
          `References: ${ticketMessageId(numero, 1)}`,
        ]
      : []),
    // Cabecera propia para poder filtrar/clasificar en el buzón por ticket.
    `X-ViaHost-Ticket: ${numero}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ].join("\r\n");

  const body = [
    m.indice > 1
      ? `Nueva respuesta del cliente en el ticket ${numero}`
      : `Nuevo ticket ${numero} desde el área de cliente de viahost.top`,
    "",
    `Asunto:    ${m.asunto}`,
    `Categoría: ${m.categoria}`,
    `Cliente:   ${m.clienteNombre}`,
    `Email:     ${m.clienteEmail}`,
    ...(m.servidor ? [`Servidor:  ${m.servidor}`] : []),
    "",
    "Mensaje:",
    m.cuerpo,
    "",
    "—",
    replyToSafe
      ? "Puedes responder directamente a este correo: la respuesta le llega al cliente y entra sola en el hilo de su área."
      : "La dirección del cliente no permite responder directamente a este correo.",
    `Ficha del ticket: ${m.adminUrl}`,
  ].join("\n");

  await pipeSendmail(TICKETS_MAILBOX, `${headers}\r\n\r\n${body}\n`);
}

export type TicketReplyMail = {
  to: string;
  clienteNombre: string;
  numero: string;
  asunto: string;
  cuerpo: string;
  /** Posición del mensaje en el hilo, para encadenarlo con los anteriores. */
  indice: number;
  /** Enlace al ticket en el área de cliente. */
  url: string;
};

/**
 * Avisa al cliente de que hemos respondido a su ticket desde el panel.
 *
 * El `Reply-To` es el buzón de soporte, de modo que si responde por correo la
 * conversación sigue donde se atiende. El texto va en inglés, como el resto de
 * la comunicación transaccional saliente (facturas): el cuerpo lo escribe quien
 * responde, en el idioma que corresponda.
 */
export async function sendTicketReplyMail(m: TicketReplyMail): Promise<void> {
  const to = headerSafe(m.to);
  if (!emailRe.test(to) || to.startsWith("-")) {
    throw new Error("Invalid recipient address.");
  }
  const numero = headerSafe(m.numero);

  const headers = [
    `From: ViaHost Support <${FROM}>`,
    `To: ${to}`,
    `Reply-To: ${TICKETS_MAILBOX}`,
    `Subject: ${encodeHeader(`Re: [${numero}] ${m.asunto}`)}`,
    `Message-ID: ${ticketMessageId(numero, m.indice)}`,
    `In-Reply-To: ${ticketMessageId(numero, 1)}`,
    `References: ${ticketMessageId(numero, 1)}`,
    `X-ViaHost-Ticket: ${numero}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ].join("\r\n");

  const body = [
    `Dear ${headerSafe(m.clienteNombre)},`,
    "",
    `We have replied to your support ticket ${numero} — ${headerSafe(m.asunto)}:`,
    "",
    m.cuerpo,
    "",
    `You can see the full conversation and reply here: ${m.url}`,
    "",
    "—",
    "ViaHost Networks, LLC",
    TICKETS_MAILBOX,
  ].join("\r\n");

  await pipeSendmail(to, `${headers}\r\n\r\n${body}\n`);
}
