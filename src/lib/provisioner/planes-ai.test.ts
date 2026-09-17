import { describe, expect, it } from "vitest";
import { derivarPlan } from "./planes-parse";
import { productosVps } from "./planes";
import { ubicacionesDePlan } from "./planes-ubicaciones";
import type { Catalogo, Categoria, Producto, Ubicacion } from "@/lib/catalogo/store";

const t = { en: "x", es: "", fr: "" };
const fechas = { creadoAt: "", actualizadoAt: "" };
const cat = (id: string, tipo: Categoria["tipo"]): Categoria => ({
  id, tipo, slug: id, nombre: t, descripcion: t, etiqueta: t, visible: true, orden: 0, ...fechas,
});
const prod = (planId: string, categoriaId: string, extra: Partial<Producto> = {}): Producto => ({
  id: planId, categoriaId, planId, nombre: planId, cpu: "2 vCore AMD EPYC", ram: "4 GB DDR4",
  almacenamiento: "50 GB NVMe", red: "", precio: 8, popular: false, visible: true, orden: 0, ...fechas, ...extra,
});
const ubic = (slug: string, provisionLocation: string): Ubicacion => ({
  id: slug, slug, nombre: t, ciudad: t, nota: t, bandera: "", cpu: "", provisionLocation,
  precioDesde: 8, mapX: 0, mapY: 0, visible: true, orden: 0, ...fechas,
});

const aiStarter = prod("ai-starter", "ai", {
  cpu: "2 vCPU AMD EPYC", ram: "6 GB RAM", almacenamiento: "60 GB NVMe", precio: 8.9, ubicacionSlug: "germany",
});

describe("AI Developer VPS en la sincronización con el provisioner", () => {
  it("las specs comerciales se traducen a los recursos exactos del plan", () => {
    expect(derivarPlan(aiStarter)).toEqual({
      ok: true,
      plan: { slug: "ai-starter", vcores: 2, ramMb: 6144, discoGb: 60, precioMesEur: 890 },
    });
    const dev = derivarPlan(prod("ai-developer", "ai", { cpu: "4 vCPU AMD EPYC", ram: "12 GB RAM", almacenamiento: "100 GB NVMe", precio: 14.9 }));
    expect(dev).toMatchObject({ ok: true, plan: { vcores: 4, ramMb: 12288, discoGb: 100, precioMesEur: 1490 } });
    const multi = derivarPlan(prod("ai-multi-agent", "ai", { cpu: "6 vCPU AMD EPYC", ram: "24 GB RAM", almacenamiento: "200 GB NVMe", precio: 24.9 }));
    expect(multi).toMatchObject({ ok: true, plan: { vcores: 6, ramMb: 24576, discoGb: 200, precioMesEur: 2490 } });
  });

  it("los planes de la categoría ai-vps van al provisioner; hosting y dedicados no", () => {
    const catalogo: Catalogo = {
      categorias: [cat("vps", "vps"), cat("ai", "ai-vps"), cat("host", "hosting"), cat("ded", "dedicados")],
      productos: [prod("vps-start", "vps"), aiStarter, prod("host-start", "host"), prod("ded-x", "ded")],
      ubicaciones: [],
    };
    expect(productosVps(catalogo).map((p) => p.planId)).toEqual(["vps-start", "ai-starter"]);
  });

  it("solo se ofrecen en Alemania, y no sacan de allí a los Cloud VPS globales", () => {
    const ubicaciones = [ubic("holanda", "nl-ams"), ubic("germany", "germany")];
    // La gama Cloud VPS sin planes propios de Alemania: el AI VPS no cuenta como "gama propia".
    const gamaVps = [prod("vps-start", "vps")];
    expect(ubicacionesDePlan(aiStarter, gamaVps, ubicaciones)).toEqual(["germany"]);
    expect(ubicacionesDePlan(gamaVps[0]!, gamaVps, ubicaciones)).toEqual(["nl-ams", "germany"]);
  });
});
