"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, Textarea, Select, FieldError } from "@/components/forms/Field";
import { eur } from "@/lib/utils";

export type ClienteOption = {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
};

type Props = {
  /** Clientes registrados para el desplegable. */
  clientes: ClienteOption[];
  /** Cliente preseleccionado (p. ej. en la ficha de un cliente). */
  preset?: ClienteOption;
};

type Errors = Record<string, string>;

/** Formulario de creación de facturas (panel admin). */
export function InvoiceForm({ clientes, preset }: Props) {
  const router = useRouter();
  const [userId, setUserId] = useState(preset?.id ?? "");
  const [clienteNombre, setClienteNombre] = useState(
    preset ? `${preset.nombre} ${preset.apellidos}`.trim() : ""
  );
  const [clienteEmail, setClienteEmail] = useState(preset?.email ?? "");
  const [concepto, setConcepto] = useState("");
  const [base, setBase] = useState("");
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

  const baseNum = Number(base);
  const ivaNum = Number(ivaPct);
  const total =
    Number.isFinite(baseNum) && baseNum > 0 && Number.isFinite(ivaNum)
      ? baseNum * (1 + ivaNum / 100)
      : 0;

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
          concepto,
          base,
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

      setDone(data.factura?.numero ?? "Factura creada");
      // Limpia el concepto/importe pero conserva el cliente para emitir varias.
      setConcepto("");
      setBase("");
      setNotas("");
      router.refresh();
    } catch {
      setGeneralError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {!preset && (
        <div>
          <Label htmlFor="cliente">Cliente registrado</Label>
          <Select id="cliente" value={userId} onChange={(e) => onPickCliente(e.target.value)}>
            <option value="">— Manual (sin cuenta) —</option>
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
            Nombre del cliente
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
            Email del cliente
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

      <div>
        <Label htmlFor="concepto" required>
          Concepto
        </Label>
        <Input
          id="concepto"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="VPS Pro · Francia · junio 2026"
        />
        <FieldError>{errors.concepto}</FieldError>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <Label htmlFor="base" required>
            Base imponible (€)
          </Label>
          <Input
            id="base"
            type="number"
            min="0"
            step="0.01"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="8.00"
          />
          <FieldError>{errors.base}</FieldError>
        </div>
        <div>
          <Label htmlFor="ivaPct">IVA (%)</Label>
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
          <Label htmlFor="vencimientoDias">Vencimiento (días)</Label>
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
        <Label htmlFor="notas">Notas (opcional)</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="min-h-20"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] pt-5">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Total con IVA:{" "}
          <span className="font-mono text-base text-[var(--color-fg)]">{eur(total, 2)}</span>
        </p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition-all hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
        >
          {busy ? "Emitiendo…" : "Emitir factura"}
        </button>
      </div>

      {generalError && <p className="text-sm text-[var(--color-danger)]">{generalError}</p>}
      {done && (
        <p className="text-sm text-[var(--color-accent)]">Factura {done} emitida correctamente.</p>
      )}
    </form>
  );
}
