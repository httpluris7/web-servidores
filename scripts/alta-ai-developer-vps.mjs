#!/usr/bin/env node
/**
 * Alta de la familia "AI Developer VPS" en el catálogo (`data/catalogo.json`).
 *
 * El catálogo vive fuera de git y se edita desde /admin/catalogo, pero el panel
 * no crea familias únicas (`tipo: "ai-vps"`) ni fija la región exclusiva de un
 * plan (`ubicacionSlug`); esto lo hace una vez. Es idempotente: si la categoría
 * o un plan ya existen NO se tocan (los precios y textos que el admin haya
 * cambiado desde el panel mandan), solo se añade lo que falte.
 *
 *   node scripts/alta-ai-developer-vps.mjs            # muestra lo que haría
 *   node scripts/alta-ai-developer-vps.mjs --aplicar  # escribe (copia previa .bak-…)
 *   … --oculta    crea la categoría con visible:false (para probar antes de publicar)
 *
 * Después: "Sincronizar con el provisioner" en /admin/catalogo (o guardar cada
 * plan) para que el provisioner cree los planes con su disponibilidad en Alemania.
 */
import { chownSync, copyFileSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "catalogo.json");
const aplicar = process.argv.includes("--aplicar");
const oculta = process.argv.includes("--oculta");

/** Región (slug de `ubicaciones`) donde se aprovisionan: Alemania — AMD EPYC 7402P. */
const REGION = "germany";

const CATEGORIA = {
  id: "a1de0b2c-6f0e-4c7b-9a51-0d5e7c1a2f30",
  tipo: "ai-vps",
  slug: "ai-developer-vps",
  nombre: { en: "AI Developer VPS", es: "AI Developer VPS", fr: "AI Developer VPS" },
  descripcion: {
    en: "VPS optimized for Claude Code, OpenAI Codex and AI-assisted development.",
    es: "VPS optimizados para Claude Code, OpenAI Codex y desarrollo asistido por IA.",
    fr: "VPS optimisés pour Claude Code, OpenAI Codex et le développement assisté par IA.",
  },
  etiqueta: { en: "🤖 Germany · AMD EPYC", es: "🤖 Alemania · AMD EPYC", fr: "🤖 Allemagne · AMD EPYC" },
};

/** Ciclo de facturación: mensual, como todos los VPS (un mes por pago; ver `servicios/periodo.ts`). */
const PLANES = [
  { id: "b7c1f4e2-3a9d-4e58-8c26-51f0a9d3e701", planId: "ai-starter", nombre: "AI Starter",
    cpu: "2 vCPU AMD EPYC", ram: "6 GB RAM", almacenamiento: "60 GB NVMe", precio: 8.9, popular: false },
  { id: "c8d2a5f3-4b0e-4f69-9d37-62a1b0e4f812", planId: "ai-developer", nombre: "AI Developer",
    cpu: "4 vCPU AMD EPYC", ram: "12 GB RAM", almacenamiento: "100 GB NVMe", precio: 14.9, popular: true },
  { id: "d9e3b6a4-5c1f-407a-8e48-73b2c1f5a923", planId: "ai-multi-agent", nombre: "AI Multi-Agent",
    cpu: "6 vCPU AMD EPYC", ram: "24 GB RAM", almacenamiento: "200 GB NVMe", precio: 24.9, popular: false },
];
const RED = "1 IPv4 · 10 Gbps network";

const catalogo = JSON.parse(readFileSync(FILE, "utf8"));
const ahora = new Date().toISOString();
const cambios = [];

const region = catalogo.ubicaciones.find((u) => u.slug === REGION);
if (!region) throw new Error(`No existe la ubicación "${REGION}" en el catálogo.`);
if (!(region.provisionLocation ?? "").trim()) {
  throw new Error(`La ubicación "${REGION}" no tiene provisionLocation: los AI VPS no se aprovisionarían solos.`);
}

let categoria = catalogo.categorias.find((c) => c.tipo === "ai-vps");
if (!categoria) {
  categoria = {
    ...CATEGORIA,
    visible: !oculta,
    // Justo detrás de Cloud VPS: es una familia dentro de VPS.
    orden: 0.5,
    creadoAt: ahora,
    actualizadoAt: ahora,
  };
  catalogo.categorias.push(categoria);
  cambios.push(`+ categoría ${categoria.slug} (tipo ai-vps, visible=${categoria.visible})`);
}

PLANES.forEach((p, i) => {
  if (catalogo.productos.some((x) => x.planId === p.planId)) return;
  catalogo.productos.push({
    id: p.id,
    categoriaId: categoria.id,
    planId: p.planId,
    nombre: p.nombre,
    cpu: p.cpu,
    ram: p.ram,
    almacenamiento: p.almacenamiento,
    red: RED,
    precio: p.precio,
    ubicacionSlug: REGION,
    popular: p.popular,
    visible: true,
    orden: i,
    creadoAt: ahora,
    actualizadoAt: ahora,
  });
  cambios.push(`+ plan ${p.planId}: ${p.cpu} / ${p.ram} / ${p.almacenamiento} · ${p.precio} €/mes · solo ${REGION}`);
});

if (cambios.length === 0) {
  console.log("Nada que hacer: la familia AI Developer VPS ya está en el catálogo.");
  process.exit(0);
}
console.log(cambios.join("\n"));
if (!aplicar) {
  console.log("\n(simulación) Repite con --aplicar para escribir data/catalogo.json");
  process.exit(0);
}

// Copia previa + escritura atómica conservando dueño y permisos (viahost:viahost 0600).
const st = statSync(FILE);
const bak = `${FILE}.bak-${ahora.replace(/[-:T]/g, "").slice(0, 14)}-ai-vps`;
copyFileSync(FILE, bak);
try { chownSync(bak, st.uid, st.gid); } catch { /* sin privilegios: la copia queda del usuario actual */ }
const tmp = `${FILE}.${process.pid}.tmp`;
writeFileSync(tmp, JSON.stringify(catalogo, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
try { chownSync(tmp, st.uid, st.gid); } catch { /* ídem */ }
renameSync(tmp, FILE);
console.log(`\nEscrito ${FILE}\nCopia previa: ${bak}`);
