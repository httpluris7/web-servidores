import { createSign, createVerify } from "node:crypto";
import type { WiseSettings } from "@/lib/ajustes";

/**
 * Cliente mínimo de la API de Wise para LEER movimientos (statement), con el que
 * el conciliador casa los ingresos por transferencia con las proformas.
 *
 * Dos particularidades de Wise que este módulo resuelve:
 *
 *  1. **SCA (PSD2).** Leer un statement exige un reto de autenticación fuerte: la
 *     primera llamada responde `403` con la cabecera `x-2fa-approval` (un token de
 *     un solo uso). Hay que FIRMAR ese token con una clave privada RSA (cuya
 *     pública se sube al panel de Wise) y reintentar la MISMA petición añadiendo
 *     `x-2fa-approval` + `X-Signature`. Se firma con RSA-SHA256 (PKCS#1 v1.5) y se
 *     codifica en base64 — exactamente lo que hace el `crypto` nativo de Node, sin
 *     dependencias nuevas.
 *
 *  2. **Sandbox vs producción.** `sandbox` decide la base de la API, para probar
 *     todo el flujo sin mover dinero real.
 *
 * Solo lectura: este módulo nunca mueve dinero. El token puede ser de lectura.
 */

export class WiseError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "WiseError";
    this.status = status;
  }
}

/** Base de la API según el entorno. */
export function wiseBaseUrl(sandbox: boolean): string {
  return sandbox ? "https://api.sandbox.transferwise.tech" : "https://api.wise.com";
}

/**
 * Verifica la firma `X-Signature-SHA256` de un webhook de Wise (RSA-SHA256 base64
 * sobre el cuerpo CRUDO) contra la clave PÚBLICA de Wise, que llega por parámetro
 * (se guarda en ajustes, no se incrusta en el código, para poder rotarla). Nunca
 * lanza: firma ausente, clave vacía o mal formada → false. Una firma que no valide
 * degrada al sondeo de 5 min, nunca a una entrega falsa.
 */
export function verifyWiseWebhook(
  rawBody: string,
  signatureB64: string,
  publicKeyPem: string
): boolean {
  try {
    if (!signatureB64 || !publicKeyPem) return false;
    const v = createVerify("RSA-SHA256");
    v.update(rawBody);
    v.end();
    return v.verify(publicKeyPem, signatureB64, "base64");
  } catch {
    return false;
  }
}

/**
 * Firma el token del reto SCA con la clave privada RSA. RSA-SHA256 (PKCS#1 v1.5)
 * y base64, que es lo que Wise valida contra la clave pública subida al panel.
 * Acepta claves en PEM tanto PKCS#1 (`BEGIN RSA PRIVATE KEY`) como PKCS#8.
 */
export function firmarScaToken(oneTimeToken: string, privateKeyPem: string): string {
  const signer = createSign("RSA-SHA256");
  signer.update(oneTimeToken);
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

export type WiseAmount = { value: number; currency: string };

/** Un movimiento del statement (formato COMPACT). Campos opcionales a la defensiva. */
export type WiseTransaction = {
  type?: string; // "CREDIT" | "DEBIT"
  date?: string;
  amount?: WiseAmount;
  totalFees?: WiseAmount;
  runningBalance?: WiseAmount;
  /** Identificador único del movimiento (clave de idempotencia). */
  referenceNumber?: string;
  details?: {
    type?: string;
    description?: string;
    /** La referencia que puso quien envía la transferencia. */
    paymentReference?: string;
    reference?: string;
    senderName?: string;
    senderAccount?: string;
  };
};

export type WiseStatement = {
  transactions?: WiseTransaction[];
  request?: { currency?: string; intervalStart?: string; intervalEnd?: string };
};

export type StatementParams = { currency: string; intervalStart: string; intervalEnd: string };

/**
 * Descarga el statement de un balance en una ventana de fechas, resolviendo el
 * reto SCA si aparece. Lanza `WiseError` si Wise responde con un estado != 2xx.
 */
export async function fetchStatement(
  cfg: WiseSettings,
  params: StatementParams
): Promise<WiseStatement> {
  const base = wiseBaseUrl(cfg.sandbox);
  const qs = new URLSearchParams({
    currency: params.currency,
    type: "COMPACT",
    intervalStart: params.intervalStart,
    intervalEnd: params.intervalEnd,
  });
  const url =
    `${base}/v1/profiles/${encodeURIComponent(cfg.profileId)}` +
    `/balance-statements/${encodeURIComponent(cfg.balanceId)}/statement.json?${qs}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiToken}`,
    "User-Agent": "viahost-web (statements-sca)",
    "Content-Type": "application/json",
  };

  let res = await fetch(url, { headers, cache: "no-store" });

  // Reto SCA: 403 + token en `x-2fa-approval` → firmar y reintentar una vez.
  if (res.status === 403) {
    const oneTimeToken = res.headers.get("x-2fa-approval");
    if (oneTimeToken) {
      // Vaciar el cuerpo del 403 antes de reintentar.
      await res.text().catch(() => "");
      const signature = firmarScaToken(oneTimeToken, cfg.privateKey);
      res = await fetch(url, {
        headers: { ...headers, "x-2fa-approval": oneTimeToken, "X-Signature": signature },
        cache: "no-store",
      });
    }
  }

  if (res.status !== 200 && res.status !== 201) {
    const body = await res.text().catch(() => "");
    throw new WiseError(`Wise statement HTTP ${res.status}: ${body.slice(0, 300)}`, res.status);
  }

  return (await res.json()) as WiseStatement;
}

/**
 * Prueba de credenciales: lee una ventana corta y devuelve cuántos movimientos
 * trae. Sirve para el botón "Probar" del panel sin depender de que haya ingresos.
 */
export async function probarWise(cfg: WiseSettings): Promise<{ transacciones: number }> {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 3600 * 1000);
  const st = await fetchStatement(cfg, {
    currency: "EUR",
    intervalStart: start.toISOString(),
    intervalEnd: now.toISOString(),
  });
  return { transacciones: st.transactions?.length ?? 0 };
}
