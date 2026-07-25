"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Label, Input, Textarea, Select, FieldError } from "@/components/forms/Field";
import { eur } from "@/lib/utils";

export type ClienteOption = {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
};

export type ProductoOption = {
  id: string;
  label: string;
  price: number;
};

type Props = {
  /** Clientes registrados para el desplegable. */
  clientes: ClienteOption[];
  /** Productos del catálogo de la web para el selector de líneas. */
  productos: ProductoOption[];
  /** Cliente preseleccionado (p. ej. en la ficha de un cliente). */
  preset?: ClienteOption;
};

type LineaState = {
  productId: string; // "" = línea personalizada
  concepto: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
};

type Errors = Record<string, string>;

const emptyLinea = (): LineaState => ({
  productId: "",
  concepto: "",
  descripcion: "",
  cantidad: "1",
  precioUnitario: "",
});

/** Formulario de creación de facturas con líneas de producto (panel admin). */
export function InvoiceForm({ clientes, productos, preset }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [userId, setUserId] = useState(preset?.id ?? "");
  const [clienteNombre, setClienteNombre] = useState(
    preset ? `${preset.nombre} ${preset.apellidos}`.trim() : ""
  );
  const [clienteEmail, setClienteEmail] = useState(preset?.email ?? "");
  const [lineas, setLineas] = useState<LineaState[]>([emptyLinea()]);
  const [ivaPct, setIvaPct] = useState("21");
  const [vencimientoDias, setVencimientoDias] = useState("30");
  const [notas, setNotas] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Si elige un cliente del desplegable, autocompletamos nombre y email.
  function onPickCliente(id: string) {
    setUserId(id);
    const c = clientes.find((c) => c.id === id);
    if (c) {
      setClienteNombre(`${c.nombre} ${c.apellidos}`.trim());
      setClienteEmail(c.email);
    }
  }

  function updateLinea(index: number, patch: Partial<LineaState>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  // Al elegir un producto del catálogo, autorrellena concepto y precio unitario.
  function onPickProducto(index: number, productId: string) {
    const prod = productos.find((p) => p.id === productId);
    if (prod) {
      updateLinea(index, {
        productId,
        concepto: prod.label,
        precioUnitario: String(prod.price),
      });
    } else {
      updateLinea(index, { productId: "" });
    }
  }

  function addLinea() {
    setLineas((prev) => [...prev, emptyLinea()]);
  }

  function removeLinea(index: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const subtotalOf = (l: LineaState) => {
    const q = Number(l.cantidad);
    const p = Number(l.precioUnitario);
    return Number.isFinite(q) && Number.isFinite(p) && q > 0 && p >= 0 ? q * p : 0;
  };

  const baseNum = lineas.reduce((acc, l) => acc + subtotalOf(l), 0);
  const ivaNum = Number(ivaPct);
  const total = baseNum > 0 && Number.isFinite(ivaNum) ? baseNum * (1 + ivaNum / 100) : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setGeneralError(null);
    setDone(null);

    try {
      const res = await fetch("/api/admin/facturas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: userId || null,
          clienteNombre,
          clienteEmail,
          lineas: lineas.map((l) => ({
            productId: l.productId || null,
            concepto: l.concepto,
            descripcion: l.descripcion,
            cantidad: Number(l.cantidad),
            precioUnitario: Number(l.precioUnitario),
          })),
          ivaPct,
          vencimientoDias,
          notas,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data.errors) setErrors(data.errors);
        if (data.error) setGeneralError(data.error);
        return;
      }

      setDone(data.factura?.numero ?? t("invoiceForm.invoiceCreated"));
      // Limpia las líneas y notas pero conserva el cliente para emitir varias.
      setLineas([emptyLinea()]);
      setNotas("");
      router.refresh();
    } catch {
      setGeneralError(t("invoiceForm.connectionError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {!preset && (
        <div>
          <Label htmlFor="cliente">{t("invoiceForm.registeredCustomer")}</Label>
          <Select id="cliente" value={userId} onChange={(e) => onPickCliente(e.target.value)}>
            <option value="">{t("invoiceForm.manualOption")}</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.apellidos} · {c.email}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="clienteNombre" required>
            {t("invoiceForm.customerName")}
          </Label>
          <Input
            id="clienteNombre"
            value={clienteNombre}
            onChange={(e) => setClienteNombre(e.target.value)}
            readOnly={!!preset}
          />
          <FieldError>{errors.clienteNombre}</FieldError>
        </div>
        <div>
          <Label htmlFor="clienteEmail" required>
            {t("invoiceForm.customerEmail")}
          </Label>
          <Input
            id="clienteEmail"
            type="email"
            value={clienteEmail}
            onChange={(e) => setClienteEmail(e.target.value)}
            readOnly={!!preset}
          />
          <FieldError>{errors.clienteEmail}</FieldError>
        </div>
      </div>

      {/* Líneas de producto */}
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Label>{t("invoiceForm.lineItems")}</Label>
          <button
            type="button"
            onClick={addLinea}
            className="text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            {t("invoiceForm.addLine")}
          </button>
        </div>

        {lineas.map((l, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <Label htmlFor={`producto-${i}`}>{t("invoiceForm.product")}</Label>
                <Select
                  id={`producto-${i}`}
                  value={l.productId}
                  onChange={(e) => onPickProducto(i, e.target.value)}
                >
                  <option value="">{t("invoiceForm.productCustom")}</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} · {eur(p.price, 2)}
                    </option>
                  ))}
                </Select>
              </div>
              {lineas.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLinea(i)}
                  aria-label={t("invoiceForm.removeLine")}
                  className="mt-7 shrink-0 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-fg-muted)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                >
                  ✕
                </button>
              )}
            </div>

            <div>
              <Label htmlFor={`concepto-${i}`} required>
                {t("invoiceForm.concept")}
              </Label>
              <Input
                id={`concepto-${i}`}
                value={l.concepto}
                onChange={(e) => updateLinea(i, { concepto: e.target.value })}
                placeholder={t("invoiceForm.conceptPlaceholder")}
              />
            </div>

            <div>
              <Label htmlFor={`descripcion-${i}`}>{t("invoiceForm.lineDescription")}</Label>
              <Textarea
                id={`descripcion-${i}`}
                value={l.descripcion}
                onChange={(e) => updateLinea(i, { descripcion: e.target.value })}
                className="min-h-16"
                placeholder={t("invoiceForm.lineDescriptionPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor={`cantidad-${i}`} required>
                  {t("invoiceForm.quantity")}
                </Label>
                <Input
                  id={`cantidad-${i}`}
                  type="number"
                  min="1"
                  step="1"
                  value={l.cantidad}
                  onChange={(e) => updateLinea(i, { cantidad: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`precio-${i}`} required>
                  {t("invoiceForm.unitPrice")}
                </Label>
                <Input
                  id={`precio-${i}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.precioUnitario}
                  onChange={(e) => updateLinea(i, { precioUnitario: e.target.value })}
                  placeholder={t("invoiceForm.basePlaceholder")}
                />
              </div>
              <div className="col-span-2 text-right sm:col-span-1">
                <span className="text-xs text-[var(--color-fg-muted)]">
                  {t("invoiceForm.subtotal")}{" "}
                </span>
                <span className="font-mono text-sm text-[var(--color-fg)]">
                  {eur(subtotalOf(l), 2)}
                </span>
              </div>
            </div>
          </div>
        ))}
        <FieldError>{errors.lineas}</FieldError>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="ivaPct">{t("invoiceForm.vat")}</Label>
          <Input
            id="ivaPct"
            type="number"
            min="0"
            max="100"
            step="1"
            value={ivaPct}
            onChange={(e) => setIvaPct(e.target.value)}
          />
          <FieldError>{errors.ivaPct}</FieldError>
        </div>
        <div>
          <Label htmlFor="vencimientoDias">{t("invoiceForm.dueDays")}</Label>
          <Input
            id="vencimientoDias"
            type="number"
            min="0"
            step="1"
            value={vencimientoDias}
            onChange={(e) => setVencimientoDias(e.target.value)}
          />
          <FieldError>{errors.vencimientoDias}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="notas">{t("invoiceForm.notes")}</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="min-h-20"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] pt-5">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {t("invoiceForm.totalWithVat")}
          <span className="font-mono text-base text-[var(--color-fg)]">{eur(total, 2)}</span>
        </p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition-all hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
        >
          {busy ? t("invoiceForm.issuing") : t("invoiceForm.issueInvoice")}
        </button>
      </div>

      {generalError && <p className="text-sm text-[var(--color-danger)]">{generalError}</p>}
      {done && (
        <p className="text-sm text-[var(--color-accent)]">{t("invoiceForm.issuedSuccessfully", { numero: done })}</p>
      )}
    </form>
  );
}
