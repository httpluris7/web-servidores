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
  return request("POST", `/vps/${vpsId}/agent-install`, { token }, 130_000);
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
