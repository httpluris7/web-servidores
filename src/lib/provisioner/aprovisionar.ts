import { provision, isConfigured, ProvisionerError } from "./client";
import { intentsDeFactura, marcarProvisionado } from "./intents";
import { registrarDespliegue } from "./despliegues";

/**
 * Dispara el aprovisionamiento de las máquinas de una factura recién pagada.
 *
 * Es el punto donde el dinero se convierte en servidores: se llama justo cuando
 * una proforma pasa a `pagada`, venga del webhook de la pasarela (tarjeta) o de
 * que el panel la marque a mano (transferencia). Lee las intenciones que el
 * checkout dejó atadas a la factura (ver `intents.ts`) y encola una provisión
 * por cada una.
 *
 * Propiedades que lo hacen seguro en el camino del dinero:
 *  - **Best-effort:** nunca lanza. El cobro ya está confirmado; un fallo del
 *    provisioner no puede tumbar el webhook ni revertir la factura. Se registra
 *    y se reintenta en la siguiente señal de pago.
 *  - **Idempotente:** el `order_ref` es estable (`inv-<factura>-<plan>`), así
 *    que el provisioner deduplica; y localmente saltamos las ya encoladas. Es
 *    seguro llamarlo más de una vez para la misma factura.
 */
export async function aprovisionarFacturaPagada(invoiceId: string): Promise<void> {
  if (!isConfigured()) return; // sin provisioner configurado, no aplica

  let intents;
  try {
    intents = await intentsDeFactura(invoiceId);
  } catch (err) {
    console.error("[aprovisionar] no se pudieron leer las intenciones de", invoiceId, err);
    return;
  }

  for (const it of intents) {
    if (it.provisionOrderId != null) continue; // ya encolada en un intento previo
    try {
      const res = await provision({
        order_ref: `inv-${it.invoiceId}-${it.planSlug}`,
        email: it.email,
        plan_slug: it.planSlug,
        location_slug: it.locationSlug,
        os_slug: it.osSlug,
        ...(it.hostname ? { hostname: it.hostname } : {}),
        idioma: it.idioma,
      });
      await marcarProvisionado(it.invoiceId, it.planSlug, res.order_id);
      // La vinculación con el cliente permite ver el despliegue en vivo y, luego,
      // la ficha del servidor. En compra anónima no hay a quién vincular: el VPS
      // se entrega igualmente por email y se podrá adoptar al registrarse.
      if (it.userId) {
        try {
          await registrarDespliegue(res.order_id, it.userId);
        } catch (err) {
          console.error("[aprovisionar] no se pudo vincular el despliegue", res.order_id, err);
        }
      }
      console.info(
        `[aprovisionar] factura ${invoiceId} · ${it.planSlug} → order ${res.order_id}` +
          (res.idempotente ? " (idempotente)" : ""),
      );
    } catch (err) {
      // Sin marcar: se reintentará. NO propagamos.
      console.error(
        `[aprovisionar] fallo aprovisionando factura ${invoiceId} · ${it.planSlug}:`,
        err instanceof ProvisionerError ? `${err.status ?? ""} ${err.message}` : err,
      );
    }
  }
}
