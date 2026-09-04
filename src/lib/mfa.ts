import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { base32Encode, generateTotpSecret, otpauthUri, verifyTotp } from "./totp";
import { site } from "@/data/site";

/**
 * Verificación en dos pasos (TOTP) por usuario.
 *
 * Almacén: `data/mfa.json` (0600), un objeto por `uid`. Entra en los backups
 * cifrados con el resto de `data/`. El secreto TOTP se guarda en claro porque
 * hace falta para calcular el código (es inherente al esquema); lo protege el
 * 0600 y el cifrado del backup. Los códigos de recuperación sí van hasheados
 * (SHA-256: son aleatorios de 40 bits, no hace falta scrypt) y se consumen.
 *
 * Reglas:
 *  - Alta en dos tiempos: `iniciar` guarda un secreto PENDIENTE (15 min) y
 *    `confirmar` lo activa solo si el usuario demuestra que su app lo tiene
 *    (código válido). Así nunca se activa un 2FA que el usuario no puede pasar.
 *  - Anti-reutilización: se recuerda el último paso TOTP aceptado y no se
 *    admite ese ni uno anterior (un código robado del hombro no vale dos veces).
 *  - Para los admins (`ADMIN_EMAILS`) el 2FA es OBLIGATORIO: lo exige el guard
 *    de `/admin` (ver lib/admin.ts). Si un admin pierde el móvil y los códigos
 *    de recuperación, la salida es borrar su entrada de `data/mfa.json` en el
 *    servidor (acceso root) y volver a darse de alta.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const MFA_FILE = path.join(DATA_DIR, "mfa.json");
const PENDIENTE_MS = 15 * 60_000;
const N_RECUPERACION = 8;

type Registro = {
  secret: string;
  enabledAt: string;
  /** Último paso TOTP aceptado (anti-replay). */
  lastStep: number;
  /** SHA-256 hex de cada código de recuperación aún no usado. */
  recovery: string[];
};
type Pendiente = { secret: string; createdAt: string };
type Entrada = { activo?: Registro; pendiente?: Pendiente };
type Almacen = Record<string, Entrada>;

async function leer(): Promise<Almacen> {
  try {
    return JSON.parse(await readFile(MFA_FILE, "utf8")) as Almacen;
  } catch {
    return {};
  }
}

async function escribir(a: Almacen): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${MFA_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(a, null, 2) + "\n", { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, MFA_FILE);
}

function hashRecuperacion(codigo: string): string {
  return createHash("sha256").update(normalizarRecuperacion(codigo)).digest("hex");
}

/** Los códigos se muestran como `XXXX-XXXX`; se aceptan con o sin guion y en cualquier caja. */
function normalizarRecuperacion(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

function generarRecuperacion(): string {
  const raw = base32Encode(randomBytes(5)); // 8 caracteres base32 = 40 bits
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

/* --------------------------------- API ----------------------------------- */

export type EstadoMfa = { enabled: boolean; enabledAt: string | null; recoveryLeft: number };

export async function estadoMfa(uid: string): Promise<EstadoMfa> {
  const e = (await leer())[uid];
  if (!e?.activo) return { enabled: false, enabledAt: null, recoveryLeft: 0 };
  return { enabled: true, enabledAt: e.activo.enabledAt, recoveryLeft: e.activo.recovery.length };
}

export async function isMfaEnabled(uid: string): Promise<boolean> {
  return !!(await leer())[uid]?.activo;
}

/** Paso 1 del alta: secreto pendiente + URI para la app (y su QR lo pinta la ruta). */
export async function iniciarAltaMfa(uid: string, email: string): Promise<{ secret: string; uri: string }> {
  const a = await leer();
  const secret = generateTotpSecret();
  a[uid] = { ...(a[uid] ?? {}), pendiente: { secret, createdAt: new Date().toISOString() } };
  await escribir(a);
  return { secret, uri: otpauthUri({ issuer: site.brand, account: email, secret }) };
}

/**
 * Paso 2 del alta: si el código casa con el secreto pendiente, se activa y se
 * devuelven los códigos de recuperación (única vez que se ven en claro).
 */
export async function confirmarAltaMfa(
  uid: string,
  code: string
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: "sin_pendiente" | "caducado" | "codigo" }> {
  const a = await leer();
  const p = a[uid]?.pendiente;
  if (!p) return { ok: false, error: "sin_pendiente" };
  if (Date.now() - Date.parse(p.createdAt) > PENDIENTE_MS) {
    delete a[uid]!.pendiente;
    await escribir(a);
    return { ok: false, error: "caducado" };
  }
  const step = verifyTotp(p.secret, code);
  if (step === null) return { ok: false, error: "codigo" };

  const recoveryCodes = Array.from({ length: N_RECUPERACION }, generarRecuperacion);
  a[uid] = {
    activo: {
      secret: p.secret,
      enabledAt: new Date().toISOString(),
      lastStep: step,
      recovery: recoveryCodes.map(hashRecuperacion),
    },
  };
  await escribir(a);
  return { ok: true, recoveryCodes };
}

export async function desactivarMfa(uid: string): Promise<void> {
  const a = await leer();
  if (!a[uid]) return;
  delete a[uid];
  await escribir(a);
}

/**
 * Verifica un código de login: TOTP (±1 paso, sin reutilizar) o un código de
 * recuperación (se consume). Devuelve qué fue, o null si no vale.
 */
export async function verificarCodigoMfa(uid: string, code: string): Promise<"totp" | "recovery" | null> {
  const a = await leer();
  const r = a[uid]?.activo;
  if (!r) return null;

  const limpio = code.trim();
  if (/^\d{6}$/.test(limpio.replace(/\s+/g, ""))) {
    const step = verifyTotp(r.secret, limpio);
    if (step === null || step <= r.lastStep) return null;
    r.lastStep = step;
    await escribir(a);
    return "totp";
  }

  // Código de recuperación: comparación en tiempo constante contra cada hash.
  const h = Buffer.from(hashRecuperacion(limpio));
  let idx = -1;
  r.recovery.forEach((stored, i) => {
    const s = Buffer.from(stored);
    if (s.length === h.length && timingSafeEqual(s, h)) idx = i;
  });
  if (idx < 0) return null;
  r.recovery.splice(idx, 1);
  await escribir(a);
  return "recovery";
}
