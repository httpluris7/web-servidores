import { describe, expect, it } from "vitest";
import type { Invoice } from "@/lib/facturas";
import { buscarProforma, indexarProformas, normRef } from "./wise-reconcile";

/** Proforma mínima para el índice: solo importan `id`, `numero` y `refPago`. */
function proforma(id: string, numero: string, refPago: string): Invoice {
  return { id, numero, refPago, estado: "pendiente" } as unknown as Invoice;
}

const a = proforma("a", "PRO-2026-5C5DF5", "VH5C5DF5");
const b = proforma("b", "PRO-2026-E7BED5", "VHE7BED5");
const indice = indexarProformas([a, b]);

describe("normRef", () => {
  it("deja solo mayúsculas y dígitos", () => {
    expect(normRef(" vh-5c5 df5 ")).toBe("VH5C5DF5");
    expect(normRef("")).toBe("");
  });
});

describe("buscarProforma", () => {
  it("casa por la referencia VH aunque venga con ruido", () => {
    expect(buscarProforma(normRef("Pago VPS ref VH-5C5DF5 gracias"), indice).inv?.id).toBe("a");
  });

  it("casa también por el número de proforma", () => {
    expect(buscarProforma(normRef("PRO-2026-E7BED5"), indice).inv?.id).toBe("b");
  });

  it("no es ambiguo si encajan las dos claves de la MISMA proforma", () => {
    const r = buscarProforma(normRef("PRO-2026-5C5DF5 / VH5C5DF5"), indice);
    expect(r.inv?.id).toBe("a");
    expect(r.ambigua).toBe(false);
  });

  it("es ambiguo si encajan proformas distintas", () => {
    const r = buscarProforma(normRef("VH5C5DF5 y VHE7BED5"), indice);
    expect(r.inv).toBeNull();
    expect(r.ambigua).toBe(true);
  });

  it("sin referencia o desconocida no casa ni es ambiguo", () => {
    expect(buscarProforma("", indice)).toEqual({ inv: null, ambigua: false });
    expect(buscarProforma(normRef("Received money from X with reference "), indice)).toEqual({
      inv: null,
      ambigua: false,
    });
  });
});
