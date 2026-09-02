import "server-only";
import type { PanelService, ServiceIp } from "./types";

/**
 * Datos SIMULADOS del panel de servicio (Fase 1 — maqueta).
 *
 * Todo lo que hay aquí es de mentira y determinista a partir del `id`: así la
 * pantalla se puede revisar con datos realistas sin tocar aún el provisioner ni
 * Proxmox. En la Fase 2 estas funciones se sustituyen por lecturas reales por el
 * BFF (que valida sesión + pertenencia); la UI no cambia porque los tipos son
 * los mismos.
 *
 * `server-only`: este módulo no debe entrar nunca en el bundle del cliente.
 */

/** Hash entero pequeño y estable de una cadena (para variar los datos por id). */
function seed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Retardo artificial para ver los skeletons de Suspense en la maqueta. */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Ficha simulada, determinista por id. Sin retardo (cabecera y rejillas). */
export function mockService(id: string): PanelService {
  const s = seed(id);
  const octeto = 20 + (s % 200);
  const encendido = s % 5 !== 0; // ~80% encendidos

  return {
    id,
    producto: "Cloud VPS",
    plan: "Scale",
    status: s % 7 === 0 ? "suspendido" : "activo",
    power: encendido ? "encendido" : "apagado",
    altaAt: "2026-05-14T10:20:00.000Z",
    importeEur: 48,
    ciclo: "mensual",
    vencimientoAt: "2026-10-14T00:00:00.000Z",
    metodoPago: "Transferencia (Wise)",

    nodo: `blade6-${1 + (s % 3)}`,
    nombre: `vps-de-scale-${100 + (s % 40)}`,
    password: "S3rv3r·Demo·2026",
    passwordManaged: false,
    uptimeSec: 60 * 60 * (12 + (s % 200)) + 37 * 60,
    creadoAt: "2026-05-14T10:22:31.000Z",
    descripcion: "Servidor de producción — web y API",
    cpu: { usado: 8 + (s % 40), total: 100, unidad: "pct" },
    cores: 4,
    memoria: { usado: 2600 + (s % 3000), total: 8192, unidad: "mb" },
    swap: { usado: s % 400, total: 2048, unidad: "mb" },
    disco: { usado: 34 + (s % 90), total: 160, unidad: "gb" },
    backupsLimite: 7,
    tasaRedMbps: 1000,
    iso: s % 4 === 0 ? "debian-12-netinst.iso" : null,
    ordenArranque: "scsi0, ide2, net0",
    anchoBanda: { usado: 420 + (s % 1500), total: 4000, unidad: "gb" },

    ips: [
      {
        version: 4,
        address: `5.83.142.${octeto}`,
        mac: `BC:24:11:${hex(s, 0)}:${hex(s, 1)}:${hex(s, 2)}`,
        netmask: "255.255.255.192",
        gateway: "5.83.142.1",
      },
      {
        version: 6,
        address: `2a11:c8c0:9::${(octeto).toString(16)}`,
        mac: `BC:24:11:${hex(s, 0)}:${hex(s, 1)}:${hex(s, 2)}`,
        netmask: "/64",
        gateway: "2a11:c8c0:9::1",
      },
    ],
    nicModel: "virtio",
    nicBridge: "vmbr0",
    nicFirewall: s % 3 === 0,
    agenteActivo: s % 2 === 0,
  };
}

function hex(s: number, i: number): string {
  return (((s >> (i * 5)) & 0xff) | 0x10).toString(16).slice(-2).toUpperCase();
}

/** Carga "asíncrona" de la información (con retardo, para el skeleton). */
export async function loadServiceInfo(id: string): Promise<PanelService> {
  await delay(450);
  return mockService(id);
}

/** Carga "asíncrona" de las IPs (con retardo, para el skeleton). */
export async function loadServiceIps(id: string): Promise<ServiceIp[]> {
  await delay(650);
  return mockService(id).ips;
}
