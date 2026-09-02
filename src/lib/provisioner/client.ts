/**
 * Cliente del servicio de aprovisionamiento (viahost-provisioner).
 *
 * SOLO servidor: usa `PROVISIONER_API_TOKEN`, que nunca debe llegar al cliente
 * (no es `NEXT_PUBLIC_*`). Habla con la API interna del provisioner —que crea y
 * gestiona los VPS sobre Proxmox— por su interfaz privada (127.0.0.1).
 *
 * La web NUNCA habla con Proxmox directamente: todo pasa por aquí.
 *
 * Si faltan las variables de entorno, el módulo queda INERTE (`isConfigured()`
 * devuelve false) y las funciones lanzan `ProvisionerError` con motivo
 * `unconfigured`, para que quien llame decida (p. ej. seguir con el flujo manual
 * de siempre) en vez de romper.
 */

import "server-only";

export class ProvisionerError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly reason?: "unconfigured" | "http" | "network" | "timeout",
  ) {
    super(message);
    this.name = "ProvisionerError";
  }
}

type Config = { apiUrl: string; token: string };

function config(): Config | null {
  const apiUrl = process.env.PROVISIONER_API_URL;
  const token = process.env.PROVISIONER_API_TOKEN;
  if (!apiUrl || !token) return null;
  return { apiUrl: apiUrl.replace(/\/+$/, ""), token };
}

/** ¿Está configurado el provisioner? Si no, el flujo automático no aplica. */
export function isConfigured(): boolean {
  return config() !== null;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 12_000,
): Promise<T> {
  const cfg = config();
  if (!cfg) {
    throw new ProvisionerError("provisioner no configurado", undefined, "unconfigured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${cfg.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ProvisionerError(
      aborted ? "timeout hablando con el provisioner" : `error de red: ${(err as Error).message}`,
      undefined,
      aborted ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText;
    throw new ProvisionerError(`provisioner respondió ${res.status}: ${detail}`, res.status, "http");
  }
  return data as T;
}

/* --------------------------------- Tipos ---------------------------------- */

export type Availability = {
  disponibilidad: Array<{
    plan_slug: string;
    location_slug: string;
    disponible: boolean;
    motivo?: string;
  }>;
};

export type ProvisionInput = {
  /** Idempotencia: mismo order_ref → mismo VPS, nunca duplica. */
  order_ref: string;
  email: string;
  plan_slug: string;
  location_slug: string;
  os_slug: string;
  hostname?: string;
  ssh_key?: string;
  idioma?: "es" | "en";
};

export type ProvisionResult = {
  order_id: number;
  estado: string;
  idempotente?: boolean;
};

export type OrderStatus = {
  order_id: number;
  estado: "queued" | "provisioning" | "active" | "failed" | "cancelled";
  error: string | null;
  plan: string;
  ubicacion: string;
  os: string;
  /** Id del VPS una vez creado (para dar de alta la ficha); null hasta entonces. */
  vps_id: number | null;
  creado: string;
  actualizado: string;
};

export type VpsInfo = {
  id: number;
  vmid: number;
  ip: string;
  usuario: string;
  estado: "creating" | "running" | "stopped" | "suspended" | "destroyed";
  location_slug: string;
  ubicacion: string;
  plan_slug: string | null;
  os_slug: string | null;
  hostname: string | null;
  vcores: number | null;
  ram_mb: number | null;
  disco_gb: number | null;
  creado: string;
};

export type VpsAction =
  | "start"
  | "stop"
  | "shutdown"
  | "reboot"
  | "reset"
  | "suspend"
  | "resume";

export type VpsSnapshot = {
  name: string;
  description?: string;
  snaptime?: number;
  parent?: string;
};

/** Datos para abrir la consola noVNC (ticket + puerto del proxy VNC de Proxmox). */
export type VncProxyInfo = {
  vmid: number;
  ticket: string;
  port: string;
  user: string;
  cert: string;
  upid: string;
};

/* ------------------------------- Operaciones ------------------------------ */

/** Salud del provisioner y conectividad con cada ubicación (público, sin auth). */
export function health(): Promise<{ status: string; ubicaciones: unknown[] }> {
  return request("GET", "/health");
}

/** Matriz plan × ubicación: qué se puede comprar ahora mismo. */
export function getAvailability(): Promise<Availability> {
  return request("GET", "/availability");
}

/** ¿Está disponible una combinación concreta plan × ubicación? */
export async function isPlanAvailable(planSlug: string, locationSlug: string): Promise<boolean> {
  const { disponibilidad } = await getAvailability();
  return disponibilidad.some(
    (d) => d.plan_slug === planSlug && d.location_slug === locationSlug && d.disponible,
  );
}

/** Encola un aprovisionamiento. Responde al instante (queued); no espera. */
export function provision(input: ProvisionInput): Promise<ProvisionResult> {
  return request("POST", "/provision", input);
}

/** Estado/progreso de un pedido de aprovisionamiento (para el polling). */
export function getOrder(orderId: number): Promise<OrderStatus> {
  return request("GET", `/orders/${orderId}`);
}

/** Ficha del VPS (estado actual, IP, plan, SO). Sin secretos. */
export function getVps(vpsId: number): Promise<VpsInfo> {
  return request("GET", `/vps/${vpsId}`);
}

export function vpsAction(vpsId: number, action: VpsAction): Promise<{ ok: boolean; estado: string }> {
  return request("POST", `/vps/${vpsId}/actions`, { action });
}

export function deleteVps(vpsId: number): Promise<{ ok: boolean }> {
  return request("DELETE", `/vps/${vpsId}`);
}

export function resendCredentials(vpsId: number): Promise<{ ok: boolean }> {
  return request("POST", `/vps/${vpsId}/resend-credentials`);
}

/** Credenciales reveladas al canjear un enlace de entrega de un solo uso. */
export type DeliveryCredentials = {
  usuario: string;
  password: string;
  ip: string | null;
  hostname: string | null;
  os: string | null;
  ubicacion: string | null;
};

/**
 * Canjea un token de entrega y devuelve la contraseña UNA vez. Lanza
 * `ProvisionerError` con status 404 (token inexistente) o 410 (ya usado o
 * caducado) para que la página muestre el mensaje correcto.
 */
export function redeemDelivery(token: string): Promise<DeliveryCredentials> {
  return request("POST", "/delivery/redeem", { token });
}

/** Cambia la contraseña de root en caliente (guest agent) y la entrega por enlace. */
export function resetVpsPassword(vpsId: number): Promise<{ ok: boolean }> {
  return request("POST", `/vps/${vpsId}/reset-password`);
}

/**
 * Instala el agente de métricas dentro de un VPS Linux por el guest agent. El
 * provisioner descarga el script y lo ejecuta dentro de la máquina, así que
 * responde despacio: timeout holgado (mayor que el del propio agent/exec).
 */
export function installAgent(vpsId: number, token: string): Promise<{ ok: boolean }> {
  // Holgado y mayor que el agent/exec del provisioner (Linux 120 s, Windows 180 s):
  // descarga el script y lo instala dentro del guest. Es fire-and-forget en la web.
  return request("POST", `/vps/${vpsId}/agent-install`, { token }, 200_000);
}

/** Encola una reinstalación del SO indicado (destructivo). */
export function reinstallVps(vpsId: number, osSlug: string): Promise<{ ok: boolean }> {
  return request("POST", `/vps/${vpsId}/reinstall`, { os_slug: osSlug });
}

export function listVpsSnapshots(vpsId: number): Promise<{ snapshots: VpsSnapshot[] }> {
  return request("GET", `/vps/${vpsId}/snapshots`);
}

export function createVpsSnapshot(
  vpsId: number,
  name?: string,
  description?: string,
): Promise<{ ok: boolean; name: string }> {
  return request("POST", `/vps/${vpsId}/snapshots`, { name, description });
}

export function rollbackVpsSnapshot(vpsId: number, name: string): Promise<{ ok: boolean }> {
  return request("POST", `/vps/${vpsId}/snapshots/${encodeURIComponent(name)}/rollback`);
}

export function deleteVpsSnapshot(vpsId: number, name: string): Promise<{ ok: boolean }> {
  return request("DELETE", `/vps/${vpsId}/snapshots/${encodeURIComponent(name)}`);
}

/** Abre un proxy VNC en Proxmox y devuelve el ticket/puerto para noVNC. */
export function vpsVncProxy(vpsId: number): Promise<VncProxyInfo & { ok: boolean }> {
  return request("POST", `/vps/${vpsId}/vncproxy`);
}

/**
 * Ficha AMPLIADA de un VPS para el panel de cliente: base + estado en vivo del
 * hipervisor (`live`, null si Proxmox no responde) + red (IP, gateway, prefijo,
 * MAC) + plan con precio. El disco/uso dentro del guest NO viene de aquí (Proxmox
 * no lo ve en QEMU): lo aporta el agente; ver el conciliador del panel.
 */
export type VpsDetalle = {
  id: number;
  vmid: number;
  ip: string;
  usuario: string;
  estado: VpsInfo["estado"];
  location_slug: string;
  ubicacion: string;
  node_nombre: string;
  plan_slug: string | null;
  os_slug: string | null;
  hostname: string | null;
  vcores: number | null;
  ram_mb: number | null;
  disco_gb: number | null;
  precio_mes_eur: number | null;
  order_id: number;
  creado: string;
  red: {
    ip: string;
    gateway: string | null;
    cidr: number | null;
    mac: string | null;
    ipv6: string | null;
    model: string | null;
    bridge: string | null;
    firewall: boolean;
  } | null;
  live: {
    status: string;
    uptime_s: number | null;
    cpu_pct: number | null;
    cpus: number | null;
    mem_bytes: number | null;
    maxmem_bytes: number | null;
    maxdisk_bytes: number | null;
    netin_bytes: number | null;
    netout_bytes: number | null;
  } | null;
  config: {
    boot_order: string | null;
    iso: string | null;
    net_rate_mbps: number | null;
  };
};

export function getVpsDetalle(vpsId: number): Promise<VpsDetalle> {
  return request("GET", `/vps/${vpsId}/detalle`);
}

/* --------------------------- Acciones asíncronas -------------------------- */

/** Una tarea de Proxmox tal como la lista el historial. */
export type VpsTask = {
  upid: string;
  type: string;
  starttime: number | null;
  endtime: number | null;
  running: boolean;
  exitstatus: string | null;
};

/**
 * Dispara una acción de energía y devuelve el UPID SIN esperar a que termine.
 * El panel sondea `vpsTaskStatus` para el progreso; no bloquea la UI.
 */
export function vpsActionAsync(
  vpsId: number,
  action: VpsAction,
): Promise<{ ok: boolean; upid: string; estado: string }> {
  return request("POST", `/vps/${vpsId}/actions-async`, { action });
}

/** Estado de una tarea concreta (para el polling). */
export function vpsTaskStatus(
  vpsId: number,
  upid: string,
): Promise<{ ok: boolean; status: string; exitstatus: string | null; done: boolean; okResult: boolean | null }> {
  return request("GET", `/vps/${vpsId}/tasks/${encodeURIComponent(upid)}`);
}

/** Historial reciente de tareas de la VM. */
export function vpsTasks(vpsId: number): Promise<{ ok: boolean; tasks: VpsTask[] }> {
  return request("GET", `/vps/${vpsId}/tasks`);
}

/* ---------------------------------- RRD ----------------------------------- */

export type RrdPoint = {
  time: number | null;
  cpu: number | null;
  mem: number | null;
  maxmem: number | null;
  netin: number | null;
  netout: number | null;
};

export type RrdTimeframe = "hour" | "day" | "week" | "month";

/** Series RRD de Proxmox para las gráficas (cuando no hay agente en el guest). */
export function vpsRrd(
  vpsId: number,
  timeframe: RrdTimeframe,
): Promise<{ ok: boolean; timeframe: RrdTimeframe; points: RrdPoint[] }> {
  return request("GET", `/vps/${vpsId}/rrd?timeframe=${timeframe}`);
}

/* -------------------------------- Backups --------------------------------- */

export type VpsBackup = {
  volid: string;
  size: number | null;
  ctime: number | null;
  format: string | null;
  notes: string | null;
};

/** Copias de la VM. `storage` es null si el nodo no tiene almacén de backup. */
export function vpsBackups(
  vpsId: number,
): Promise<{ ok: boolean; storage: string | null; backups: VpsBackup[] }> {
  return request("GET", `/vps/${vpsId}/backups`);
}

/** Lanza una copia (vzdump) y devuelve el UPID para sondear la tarea. */
export function createVpsBackup(vpsId: number): Promise<{ ok: boolean; upid: string; storage: string }> {
  return request("POST", `/vps/${vpsId}/backups`);
}

/** Borra un fichero de copia (volid) de la VM. */
export function deleteVpsBackup(vpsId: number, volid: string): Promise<{ ok: boolean }> {
  return request("DELETE", `/vps/${vpsId}/backups?volid=${encodeURIComponent(volid)}`);
}

/* -------------------------------- Firewall -------------------------------- */

export type VpsFirewallOptions = { enable: number; policy_in: string; policy_out: string };
export type VpsFirewallRule = {
  pos: number | null;
  type: string | null;
  action: string | null;
  proto: string | null;
  dport: string | null;
  source: string | null;
  dest: string | null;
  enable: number;
  comment: string | null;
};

export function vpsFirewall(
  vpsId: number,
): Promise<{ ok: boolean; options: VpsFirewallOptions; rules: VpsFirewallRule[] }> {
  return request("GET", `/vps/${vpsId}/firewall`);
}

export function setVpsFirewallOptions(
  vpsId: number,
  opts: { enable?: 0 | 1; policy_in?: string; policy_out?: string },
): Promise<{ ok: boolean }> {
  return request("PUT", `/vps/${vpsId}/firewall/options`, opts);
}

export function addVpsFirewallRule(
  vpsId: number,
  rule: { type: string; action: string; proto?: string; dport?: string; source?: string; comment?: string },
): Promise<{ ok: boolean }> {
  return request("POST", `/vps/${vpsId}/firewall/rules`, rule);
}

export function deleteVpsFirewallRule(vpsId: number, pos: number): Promise<{ ok: boolean }> {
  return request("DELETE", `/vps/${vpsId}/firewall/rules?pos=${pos}`);
}
