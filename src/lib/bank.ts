import { site } from "@/data/site";

/**
 * Pago por transferencia bancaria.
 *
 * Es el método de cobro activo mientras no haya pasarela: el cliente recibe una
 * proforma y transfiere el importe a la cuenta de `site.bank`. La CLAVE del
 * flujo es la referencia: el cliente tiene que poner el número de proforma
 * (PRO-AAAA-XXXXXX) como concepto, porque es lo único que permite casar el
 * ingreso con su pedido. Por eso la referencia se repite —y se destaca— en la
 * proforma (PDF y hoja imprimible) y en el correo.
 *
 * Este módulo es la única fuente de los datos bancarios y de su orden de
 * lectura; PDF, correo y pantallas los consumen de aquí para no divergir.
 */

/** Agrupa el IBAN de cuatro en cuatro, que es como se lee y se teclea. */
export function formatIban(iban: string): string {
  return iban
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export type BankRowKey = "beneficiary" | "iban" | "bic" | "bank" | "amount" | "reference";

export type BankRow = { key: BankRowKey; value: string };

/** Etiquetas en inglés (PDF y correo van siempre en inglés, como las facturas). */
export const BANK_LABEL_EN: Record<BankRowKey, string> = {
  beneficiary: "Beneficiary",
  iban: "IBAN",
  bic: "SWIFT / BIC",
  bank: "Bank",
  amount: "Amount",
  reference: "Payment reference",
};

/**
 * Datos de la transferencia, en orden de lectura.
 *
 * `amountLabel` y `reference` son opcionales porque hay sitios donde todavía no
 * existen: en la confirmación del pedido aún no se ha emitido la proforma, así
 * que se muestran los datos de la cuenta y se explica que la referencia llegará
 * por correo.
 */
export function bankRows(opts: { amountLabel?: string; reference?: string } = {}): BankRow[] {
  const rows: BankRow[] = [
    { key: "beneficiary", value: site.bank.beneficiary },
    { key: "iban", value: formatIban(site.bank.iban) },
    { key: "bic", value: site.bank.bic },
    { key: "bank", value: `${site.bank.bankName} — ${site.bank.bankAddress}` },
  ];
  if (opts.amountLabel) rows.push({ key: "amount", value: opts.amountLabel });
  if (opts.reference) rows.push({ key: "reference", value: opts.reference });
  return rows;
}

/** Aviso (en inglés) de que sin la referencia no se puede identificar el ingreso. */
export function bankReferenceNoteEn(reference: string): string {
  return `Please quote ${reference} as the payment reference. Without it we cannot match your transfer to your order.`;
}
