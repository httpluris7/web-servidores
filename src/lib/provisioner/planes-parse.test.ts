import { describe, it, expect } from "vitest";
import { derivarPlan } from "./planes-parse";
import type { Producto } from "@/lib/catalogo/store";

const base: Producto = {
  id: "x", categoriaId: "c", planId: "vps-start", nombre: "VPS Start", cpu: "2 vCore AMD EPYC", ram: "4 GB DDR4",
  almacenamiento: "50 GB NVMe", red: "1 Gbps", precio: 8, popular: false, visible: true, orden: 1, creadoAt: "", actualizadoAt: "",
};

describe("derivarPlan", () => {
  it("traduce specs de texto a unidades del provisioner", () => {
    const r = derivarPlan(base);
    expect(r).toEqual({ ok: true, plan: { slug: "vps-start", vcores: 2, ramMb: 4096, discoGb: 50, precioMesEur: 800 } });
  });
  it("admite variantes: 'Gen4', decimales, TB, 'núcleos' y precio con céntimos", () => {
    const r = derivarPlan({ ...base, cpu: "16 núcleos", ram: "1.5 GB", almacenamiento: "1 TB NVMe Gen4", precio: 16.95 });
    expect(r).toEqual({ ok: true, plan: { slug: "vps-start", vcores: 16, ramMb: 1536, discoGb: 1024, precioMesEur: 1695 } });
  });
  it("rechaza specs no interpretables sin inventar valores", () => {
    expect(derivarPlan({ ...base, cpu: "rápida" })).toEqual({ ok: false, planId: "vps-start", motivo: "cpu" });
    expect(derivarPlan({ ...base, almacenamiento: "mucho" })).toEqual({ ok: false, planId: "vps-start", motivo: "disco" });
    expect(derivarPlan({ ...base, ram: "8 MB" }).ok).toBe(true); // MB válido
    expect(derivarPlan({ ...base, almacenamiento: "512 MB" })).toEqual({ ok: false, planId: "vps-start", motivo: "disco" }); // <1 GB
  });
});
