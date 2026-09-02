import "server-only";
import { createHash, randomInt } from "node:crypto";
import { readSettings } from "@/lib/ajustes";
import { appendInvoiceNota } from "@/lib/facturas";
import { sendHostingWelcomeMail } from "@/lib/mail";
import { createAccount, hostingConfigured, WhmError } from "./whm";
import { intentsDeFactura, marcarProvisionado, type HostingIntent } from "./intents";

/**
 * Crea en cPanel (web01) las cuentas de hosting de una factura recién pagada.
 *
 * Es el punto donde el dinero se convierte en hosting: se llama justo cuando una
 * proforma pasa a `pagada`, venga del webhook de la pasarela (tarjeta), del
 * conciliador de Wise (transferencia) o de que el panel la marque a mano. Mismas
 * garantías que el aprovisionamiento de VPS y el registro de dominios:
 *  - **Best-effort:** nunca lanza. El cobro ya está confirmado; un fallo de WHM
 *    no puede tumbar el webhook ni revertir la factura. Se registra y se reintenta.
 *  - **Idempotente:** el `username` es DETERMINISTA por (factura, plan), así que
 *    un reintento reusa el mismo usuario y WHM deduplica; y localmente saltamos
 *    las ya marcadas. Es seguro llamarlo más de una vez para la misma factura.
 *
 * El dominio primario es TEMPORAL (`<user>.<baseDomain>`, p. ej.
 * `vhabc123.cp.viahost.top`): la cuenta queda operativa al instante por su URL
 * temporal y el cliente apunta su dominio real después (lo cambia en cPanel o
 * abre un ticket). La base es un subdominio SIN zona local en el nodo (la zona
 * del hostname `web01.viahost.top` sí existe y chocaría). Ver la nota del correo.
 */
export async function aprovisionarHostingFacturaPagada(invoiceId: string): Promise<void> {
  let intents: HostingIntent[];
  try {
    intents = await intentsDeFactura(invoiceId);
  } catch (err) {
    console.error("[hosting] no se pudieron leer las intenciones de", invoiceId, err);
    return;
  }
  const pendientes = intents.filter((it) => !it.provisioned);
  if (pendientes.length === 0) return;

  const { hosting } = await readSettings();
  if (!hostingConfigured(hosting)) {
    console.error("[hosting] ⚠ factura", invoiceId, "con hosting pero WHM sin configurar");
    await nota(invoiceId, `⚠ Alta de hosting pendiente (WHM sin configurar): ${listar(pendientes)}`);
    return;
  }
  const baseDomain = hosting.baseDomain.trim() || "cp.viahost.top";
  const panelHost = hosting.whmHost.trim() || "web01.viahost.top";

  const fallos: string[] = [];
  for (const it of pendientes) {
    if (!it.cpanelPackage) {
      fallos.push(it.planId);
      continue;
    }
    const username = usuarioDeterminista(it.invoiceId, it.planId);
    const domain = `${username}.${baseDomain}`;
    const password = generarPassword();
    try {
      const r = await createAccount({
        username,
        domain,
        plan: it.cpanelPackage,
        password,
        contactemail: it.email,
      });
      await marcarProvisionado(it.invoiceId, it.planId, username, domain);

      if (r.already) {
        // La cuenta ya existía (reintento tras un corte): no tenemos su
        // contraseña para reenviarla. Se marca como provisionada y se anota.
        await nota(invoiceId, `Hosting ya existente reusado: ${domain} (usuario ${username})`);
        console.info(`[hosting] cuenta ya existente ${username} · factura ${invoiceId}`);
        continue;
      }

      await nota(invoiceId, `Hosting creado: ${domain} (usuario ${username}, ${it.cpanelPackage})`);
      console.info(`[hosting] cuenta creada ${username} (${domain}) · factura ${invoiceId}`);

      // Credenciales al cliente. Best-effort: la cuenta ya está; si el correo
      // falla, se anota para reenviar/resetear a mano (no se revierte nada).
      try {
        await sendHostingWelcomeMail({
          to: it.email,
          nombre: it.nombre,
          idioma: it.idioma,
          username,
          password,
          domain,
          panelHost,
        });
      } catch (err) {
        console.error(`[hosting] no se pudieron enviar las credenciales de ${username}:`, err);
        await nota(invoiceId, `⚠ Cuenta ${domain} creada pero el correo de credenciales falló (reenviar/resetear a mano).`);
      }
    } catch (err) {
      fallos.push(it.planId);
      console.error(
        `[hosting] fallo creando cuenta de ${it.planId} · factura ${invoiceId}:`,
        err instanceof WhmError ? `${err.reason} ${err.message}` : err,
      );
    }
  }

  if (fallos.length > 0) {
    // Sin marcar: se reintentará en la siguiente señal de pago o a mano.
    await nota(invoiceId, `⚠ Alta de hosting pendiente (revisar): ${fallos.join(", ")}`);
  }
}

/** Usuario de cPanel determinista por (factura, plan): 8 chars, empieza por letra. */
function usuarioDeterminista(invoiceId: string, planId: string): string {
  const h = createHash("sha1").update(`${invoiceId}:${planId}`).digest("hex").slice(0, 6);
  return `vh${h}`;
}

/**
 * Contraseña fuerte para cPanel: 20 caracteres con las 4 clases (mayús, minús,
 * dígito, símbolo), garantizando al menos una de cada y barajando el resto.
 */
function generarPassword(): string {
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const L = "abcdefghijkmnpqrstuvwxyz";
  const D = "23456789";
  const S = "!@#%^*-_=+";
  const todos = U + L + D + S;
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(U), pick(L), pick(D), pick(S)];
  while (chars.length < 20) chars.push(pick(todos));
  // Barajado Fisher-Yates con aleatoriedad criptográfica.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function listar(pend: Array<{ planId: string }>): string {
  return pend.map((p) => p.planId).join(", ");
}

async function nota(invoiceId: string, text: string): Promise<void> {
  try {
    await appendInvoiceNota(invoiceId, text);
  } catch (err) {
    console.error("[hosting] no se pudo anotar en la factura", invoiceId, err);
  }
}
