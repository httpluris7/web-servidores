import "server-only";

/**
 * Mapeo estable planId (catálogo) → paquete de cPanel (WHM) en web01.
 *
 * Los planId son inmutables (van en facturas ya emitidas) y los paquetes se
 * llaman igual en el nodo (`viahost-<tramo>`), alineados en límites con las
 * specs del catálogo (disco, addon = sitios−1, correo, BBDD). Si algún día se
 * añade un plan de hosting, se añade aquí su paquete; un plan sin entrada NO se
 * aprovisiona (se anota en la factura para alta manual).
 */
const PAQUETE_POR_PLAN: Record<string, string> = {
  "host-start": "viahost-start",
  "host-pro": "viahost-pro",
  "host-business": "viahost-business",
  "host-agency": "viahost-agency",
};

/** Paquete cPanel para un plan de hosting, o `null` si el plan no es de hosting. */
export function paqueteDePlan(planId: string): string | null {
  return PAQUETE_POR_PLAN[planId] ?? null;
}
