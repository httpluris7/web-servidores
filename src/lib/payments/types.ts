/**
 * Tipos compartidos del subsistema de pagos.
 *
 * El objetivo es que el endpoint del webhook sea AGNÓSTICO de la pasarela: cada
 * proveedor (Stripe, Redsys, PayPal…) implementa un `PaymentVerifier` que
 * (1) valida la firma del webhook y (2) normaliza el evento a `PaymentEvent`.
 * El resto del flujo (idempotencia, validación de importe, fulfillment) es común.
 */

/** Evento de pago normalizado, independiente del proveedor. */
export type PaymentEvent = {
  /** Id único del evento en el proveedor — clave de idempotencia. */
  id: string;
  /** Tipo del evento tal cual lo da el proveedor (p. ej. payment_intent.succeeded). */
  type: string;
  /** ¿Representa un pago confirmado con éxito? */
  succeeded: boolean;
  /** Nuestro id de pedido, propagado vía metadata al crear el cobro (o null). */
  orderId: string | null;
  /** Importe pagado en la unidad mínima (céntimos), tal como lo reporta el proveedor. */
  amountCents: number | null;
  /** Divisa ISO-4217 en minúsculas (p. ej. "eur"). */
  currency: string | null;
  /** Payload crudo ya parseado, por si el fulfillment necesita más campos. */
  raw: unknown;
};

/** Resultado de verificar+normalizar un webhook entrante. */
export type VerifyResult =
  | { ok: true; event: PaymentEvent }
  /** La pasarela no está configurada (falta provider/secreto): el endpoint queda inerte. */
  | { ok: false; reason: "unconfigured" }
  /** Firma inválida, ausente, o fuera de la ventana anti-replay. */
  | { ok: false; reason: "invalid"; detail?: string };

/** Contrato que implementa cada pasarela. */
export interface PaymentVerifier {
  readonly provider: string;
  /**
   * Verifica la firma del webhook sobre el CUERPO CRUDO (sin reparsear) y, si es
   * válida, devuelve el evento normalizado.
   */
  verify(rawBody: string, headers: Headers): Promise<VerifyResult> | VerifyResult;
}
