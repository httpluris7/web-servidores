/**
 * Adaptador de un VPS de nuestro Proxmox (viahost-provisioner) a la forma
 * `ProviderServer` que ya pinta el área de cliente.
 *
 * Así los VPS de Proxmox se muestran con las MISMAS pantallas que los del
 * proveedor externo, sin duplicar UI. Lo que no aplica (proyectos, uuid del
 * proveedor, consumo instantáneo) se deja en null/vacío y las pantallas ya
 * saben mostrar "—".
 */
import type { ProviderServer } from "./v4vm";
import type { ManagedServer } from "./store";
import { getVps, type VpsInfo } from "@/lib/provisioner/client";

/** Estado del provisioner → estado que entiende ServerStatusBadge. */
function mapEstado(estado: VpsInfo["estado"]): { status: string; processing: boolean } {
  switch (estado) {
    case "running":
      return { status: "started", processing: false };
    case "stopped":
    case "destroyed":
      return { status: "stopped", processing: false };
    case "suspended":
      return { status: "suspended", processing: false };
    case "creating":
      // Aún aprovisionándose: la insignia lo muestra como "en proceso".
      return { status: "started", processing: true };
  }
}

export function adaptVpsToRemote(vps: VpsInfo, managed: ManagedServer): ProviderServer {
  const { status, processing } = mapEstado(vps.estado);
  return {
    id: vps.id,
    uuid: managed.remoteUuid || "",
    name: managed.etiqueta || vps.hostname || `vps-${vps.vmid}`,
    description: "",
    status,
    realStatus: null,
    isProcessing: processing,
    isSuspended: vps.estado === "suspended",
    progress: null,
    osType: vps.os_slug,
    plan: vps.plan_slug,
    location: vps.ubicacion,
    ipv4: vps.ip ? [vps.ip] : [],
    ipv6: [],
    vcpu: vps.vcores,
    ramMb: vps.ram_mb,
    diskGb: vps.disco_gb,
    projectId: null,
    projectName: null,
    createdAt: vps.creado ?? null,
    usage: {
      cpuPct: null,
      diskBytes: null,
      trafficInBytes: null,
      trafficOutBytes: null,
      trafficExceeded: false,
    },
  };
}

/**
 * Estado en vivo de un VPS de Proxmox, adaptado a `ProviderServer`.
 * Devuelve null si el provisioner no responde o el VPS ya no existe: la
 * pantalla lo trata como una ficha huérfana, igual que con el proveedor.
 */
export async function proxmoxRemote(managed: ManagedServer): Promise<ProviderServer | null> {
  try {
    const vps = await getVps(managed.remoteId);
    if (vps.estado === "destroyed") return null;
    return adaptVpsToRemote(vps, managed);
  } catch {
    return null;
  }
}
