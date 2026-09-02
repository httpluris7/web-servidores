import "server-only";
import { njallaCanRegister, readSettings } from "@/lib/ajustes";
import { appendInvoiceNota } from "@/lib/facturas";
import { getBalance, NjallaError, registerDomain, renewDomain } from "./njalla";
import { intentsDeFactura, marcarRegistrado } from "./intents";

/**
 * Registra en Njalla los dominios de una factura recién pagada (CP3).
 *
 * Es el punto donde el dinero se convierte en dominios: se llama justo cuando una
 * proforma pasa a `pagada`, venga del webhook de la pasarela (tarjeta), del
 * conciliador de Wise (transferencia) o de que el panel la marque a mano. Mismas
 * garantías que el aprovisionamiento de VPS:
 *  - **Best-effort:** nunca lanza. El cobro ya está confirmado; un fallo de Njalla
 *    no puede tumbar el webhook ni revertir la factura. Se registra y se reintenta.
 *  - **Idempotente:** `marcarRegistrado` marca cada dominio; los ya registrados se
 *    saltan. Es seguro llamarlo más de una vez para la misma factura.
 *  - **Consciente del saldo:** registrar gasta del monedero; si está a 0 no se
 *    intenta (para no generar ruido) y se deja anotado en la factura.
 */
export async function registrarDominiosFacturaPagada(invoiceId: string): Promise<void> {
  let intents;
  try {
    intents = await intentsDeFactura(invoiceId);
  } catch (err) {
    console.error("[dominios] no se pudieron leer las intenciones de", invoiceId, err);
    return;
  }
  const pendientes = intents.filter((it) => !it.registered);
  if (pendientes.length === 0) return;

  const { njalla } = await readSettings();
  if (!njallaCanRegister(njalla)) {
    console.error("[dominios] ⚠ factura", invoiceId, "con dominios pero Njalla sin token de registro");
    await nota(invoiceId, `⚠ Registro de dominio pendiente (falta token de registro Njalla): ${listar(pendientes)}`);
    return;
  }

  // Saldo del monedero: si está a 0, no intentamos registrar (fallaría) y lo
  // dejamos anotado para reintentarlo cuando se fondee.
  let saldo: number | null = null;
  try {
    saldo = await getBalance();
  } catch (err) {
    console.error("[dominios] no se pudo leer el saldo de Njalla:", err);
  }
  if (saldo != null && saldo <= 0) {
    console.error(`[dominios] ⚠ saldo Njalla ${saldo}: no se registran los dominios de ${invoiceId}`);
    await nota(invoiceId, `⚠ Registro de dominio pendiente (saldo Njalla insuficiente): ${listar(pendientes)}`);
    return;
  }

  const fallos: string[] = [];
  for (const it of pendientes) {
    const verbo = it.renewal ? "renovado" : "registrado";
    try {
      if (it.renewal) {
        await renewDomain(it.domain, it.years);
        await marcarRegistrado(it.invoiceId, it.domain, it.domain);
      } else {
        const r = await registerDomain(it.domain, it.years);
        await marcarRegistrado(it.invoiceId, it.domain, r.name);
      }
      await nota(invoiceId, `Dominio ${verbo}: ${it.domain} (${it.years} año${it.years > 1 ? "s" : ""})`);
      console.info(`[dominios] ${verbo} ${it.domain} · factura ${invoiceId}`);
    } catch (err) {
      fallos.push(it.domain);
      console.error(
        `[dominios] fallo ${it.renewal ? "renovando" : "registrando"} ${it.domain} · factura ${invoiceId}:`,
        err instanceof NjallaError ? `${err.reason} ${err.message}` : err,
      );
    }
  }

  if (fallos.length > 0) {
    // Sin marcar: se reintentará en la siguiente señal de pago o a mano.
    await nota(invoiceId, `⚠ Registro de dominio pendiente (revisar): ${fallos.join(", ")}`);
  }
}

function listar(pend: Array<{ domain: string }>): string {
  return pend.map((p) => p.domain).join(", ");
}

async function nota(invoiceId: string, text: string): Promise<void> {
  try {
    await appendInvoiceNota(invoiceId, text);
  } catch (err) {
    console.error("[dominios] no se pudo anotar en la factura", invoiceId, err);
  }
}
