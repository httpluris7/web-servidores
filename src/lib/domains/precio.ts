/**
 * Precio al cliente de un dominio: coste de Njalla (EUR/año) + margen, redondeado
 * al alza a euro entero (misma filosofía que el redondeo de divisa del sitio).
 * Puro: sin secretos aquí (el margen lo trae la config y lo pasa quien llama).
 */
export function precioDominioEur(costeNjallaEur: number, margenPct: number): number {
  if (!Number.isFinite(costeNjallaEur) || costeNjallaEur < 0) return 0;
  const bruto = costeNjallaEur * (1 + Math.max(0, margenPct) / 100);
  return Math.ceil(bruto);
}
