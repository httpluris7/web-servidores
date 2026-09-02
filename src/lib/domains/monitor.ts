import "server-only";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { njallaCanRegister, njallaHasCreds, readSettings } from "@/lib/ajustes";
import { ALERT_FALLBACK_MAILBOX, sendAlertMail } from "@/lib/mail";
import { site } from "@/data/site";
import { checkoutOrder } from "@/lib/payments/checkout";
import { findDomains, getBalance, listDomains, NjallaError } from "./njalla";
import { altasRegistradas, registrarDomainIntent } from "./intents";
import { precioDominioEur } from "./precio";

/**
 * Trabajos periódicos de dominios (CP5), colgados del latido de 5 min:
 *  1. **Monitor de saldo:** si el monedero de Njalla baja del umbral, avisa al
 *     admin (una vez cada 24 h para no repetir).
 *  2. **Barrido de renovaciones (1×/día):** por cada dominio que vence pronto,
 *     emite una proforma de renovación y se la manda al cliente; al pagarla,
 *     `registrarDominiosFacturaPagada` llama a `renew-domain`. Se anota lo ya
 *     avisado para no emitir dos veces la misma renovación.
 *
 * Best-effort: nunca lanza. El estado vive en `data/domain-monitor.json` para
 * sobrevivir a los despliegues.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "domain-monitor.json");

/** Días antes del vencimiento en que se ofrece renovar. */
const VENTANA_DIAS = 30;
/** El barrido de renovaciones corre como mucho una vez al día. */
const BARRIDO_MIN_H = 20;
/** No repetir el aviso de saldo bajo antes de 24 h. */
const AVISO_SALDO_MIN_H = 24;

type Estado = {
  lastBalanceAlertAt: string | null;
  lastRenewalSweepAt: string | null;
  /** domain → expiry (ISO) por el que ya se emitió renovación (para no repetir). */
  remindedExpiry: Record<string, string>;
};

async function leerEstado(): Promise<Estado> {
  try {
    const o = JSON.parse(await readFile(FILE, "utf8")) as Partial<Estado>;
    return {
      lastBalanceAlertAt: typeof o.lastBalanceAlertAt === "string" ? o.lastBalanceAlertAt : null,
      lastRenewalSweepAt: typeof o.lastRenewalSweepAt === "string" ? o.lastRenewalSweepAt : null,
      remindedExpiry: o.remindedExpiry && typeof o.remindedExpiry === "object" ? o.remindedExpiry : {},
    };
  } catch {
    return { lastBalanceAlertAt: null, lastRenewalSweepAt: null, remindedExpiry: {} };
  }
}

async function guardarEstado(e: Estado): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(e, null, 2), { encoding: "utf8", mode: 0o600 });
  await chmod(FILE, 0o600);
}

const horas = (iso: string | null): number =>
  iso ? (Date.now() - Date.parse(iso)) / 3_600_000 : Infinity;

/** Punto de entrada del latido. Nunca lanza. */
export async function comprobarDominios(): Promise<void> {
  try {
    const { njalla } = await readSettings();
    if (!njallaHasCreds(njalla)) return; // sin token de lectura, nada que hacer

    const estado = await leerEstado();
    let cambiado = false;

    cambiado = (await monitorSaldo(njalla.saldoMinimo, estado)) || cambiado;
    // Renovaciones: solo si se puede registrar/renovar y ha pasado el intervalo.
    if (njallaCanRegister(njalla) && horas(estado.lastRenewalSweepAt) >= BARRIDO_MIN_H) {
      cambiado = (await barrerRenovaciones(njalla.margenPct, estado)) || cambiado;
      estado.lastRenewalSweepAt = new Date().toISOString();
      cambiado = true;
    }

    if (cambiado) await guardarEstado(estado);
  } catch (err) {
    console.error("[dominios] fallo en el monitor:", err);
  }
}

/* ------------------------------ Monitor de saldo -------------------------- */

async function monitorSaldo(umbral: number, estado: Estado): Promise<boolean> {
  let saldo: number;
  try {
    saldo = await getBalance();
  } catch {
    return false; // sin saldo legible, no se avisa
  }
  if (saldo >= umbral) {
    // Se recuperó: se olvida el último aviso para poder volver a avisar si baja.
    if (estado.lastBalanceAlertAt) {
      estado.lastBalanceAlertAt = null;
      return true;
    }
    return false;
  }
  // Por debajo del umbral: avisar como mucho una vez cada 24 h.
  if (horas(estado.lastBalanceAlertAt) < AVISO_SALDO_MIN_H) return false;
  try {
    await sendAlertMail({
      to: [ALERT_FALLBACK_MAILBOX],
      servidor: "Njalla",
      metrica: "Saldo del monedero",
      resumen: "Saldo bajo en el monedero de dominios (Njalla)",
      valor: `${saldo} €`,
      umbral: `${umbral} €`,
      desde: new Date().toISOString(),
      url: `${site.url}/admin/configuracion`,
      activa: true,
    });
    console.warn(`[dominios] aviso de saldo bajo enviado (${saldo} € < ${umbral} €)`);
  } catch (err) {
    console.error("[dominios] no se pudo enviar el aviso de saldo bajo:", err);
  }
  estado.lastBalanceAlertAt = new Date().toISOString();
  return true;
}

/* --------------------------- Barrido de renovaciones ---------------------- */

async function barrerRenovaciones(margenPct: number, estado: Estado): Promise<boolean> {
  let altas;
  let expiryPorDominio: Map<string, string | null>;
  try {
    altas = await altasRegistradas();
    if (altas.length === 0) return false;
    const dominios = await listDomains();
    expiryPorDominio = new Map(dominios.map((d) => [d.name.toLowerCase(), d.expiry]));
  } catch (err) {
    console.error("[dominios] barrido de renovaciones: no se pudo leer:", err);
    return false;
  }

  const ahora = Date.now();
  const cachePrecio = new Map<string, number | null>();
  let cambiado = false;

  for (const it of altas) {
    const expiry = expiryPorDominio.get(it.domain.toLowerCase());
    if (!expiry) continue;
    const dias = (Date.parse(expiry) - ahora) / 86_400_000;
    if (!(dias > 0 && dias <= VENTANA_DIAS)) continue;
    // Ya avisado para ESTE vencimiento: no repetir hasta que renueve (y cambie).
    if (estado.remindedExpiry[it.domain] === expiry) continue;

    const precio = await precioTld(it.domain, margenPct, cachePrecio);
    if (precio == null) {
      console.warn(`[dominios] renovación de ${it.domain}: sin precio, se omite`);
      continue;
    }

    try {
      const { invoice } = await checkoutOrder({
        userId: it.userId,
        clienteNombre: it.email.split("@")[0] || "Cliente",
        clienteEmail: it.email,
        lineas: [
          {
            concepto: it.idioma === "es" ? `Renovación ${it.domain}` : `Renewal ${it.domain}`,
            descripcion:
              it.idioma === "es" ? "1 año · privacidad WHOIS incluida" : "1 year · WHOIS privacy included",
            cantidad: 1,
            precioUnitario: precio,
            productId: `domain:${it.domain}`,
          },
        ],
        metodo: "transferencia",
        locale: it.idioma,
        cancelPath: "/cuenta/dominios",
      });
      await registrarDomainIntent({
        invoiceId: invoice.id,
        domain: it.domain,
        years: 1,
        userId: it.userId,
        email: it.email,
        idioma: it.idioma,
        renewal: true,
      });
      estado.remindedExpiry[it.domain] = expiry;
      cambiado = true;
      console.info(`[dominios] proforma de renovación emitida para ${it.domain} (vence ${expiry})`);
    } catch (err) {
      console.error(
        `[dominios] no se pudo emitir la renovación de ${it.domain}:`,
        err instanceof NjallaError ? err.message : err,
      );
    }
  }
  return cambiado;
}

/** Precio al cliente de renovar un TLD (aprox. por el precio de alta del TLD). */
async function precioTld(
  domain: string,
  margenPct: number,
  cache: Map<string, number | null>,
): Promise<number | null> {
  const tld = domain.includes(".") ? domain.slice(domain.indexOf(".") + 1) : "";
  if (!tld) return null;
  if (cache.has(tld)) return cache.get(tld) ?? null;
  try {
    // Un término aleatorio disponible para leer el precio de ese TLD.
    const ofertas = await findDomains(`vh${Date.now().toString(36)}`);
    const m = ofertas.find((o) => o.name.endsWith(`.${tld}`) && o.price != null);
    const precio = m?.price != null ? precioDominioEur(m.price, margenPct) : null;
    cache.set(tld, precio);
    return precio;
  } catch {
    cache.set(tld, null);
    return null;
  }
}
