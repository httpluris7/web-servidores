/** Un mes natural después (misma hora). 31 ene + 1 mes → 28/29 feb, no 2/3 mar. */
export function masUnMes(iso: string): string {
  const d = new Date(iso);
  const dia = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  if (d.getUTCDate() !== dia) d.setUTCDate(0);
  return d.toISOString();
}
