import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) sobre HOTP (RFC 4226), sin dependencias: HMAC-SHA1, 6 dígitos,
 * paso de 30 s. Es lo que entienden Google Authenticator, Aegis, 1Password,
 * Bitwarden, Authy… vía un URI `otpauth://`.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

/** Base32 (RFC 4648, sin relleno): es el formato de secreto que piden las apps. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const limpio = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of limpio) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Secreto nuevo: 160 bits (lo que recomienda RFC 4226), en base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP: HMAC-SHA1(secret, contador de 8 bytes) → truncado dinámico → 6 dígitos. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** Paso de tiempo actual (o de un instante dado). */
export function totpStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

export function totpCode(secretB32: string, step = totpStep()): string {
  return hotp(base32Decode(secretB32), step);
}

/**
 * Verifica un código admitiendo ±`window` pasos (desfase de reloj del móvil).
 * Devuelve el paso que casó (para bloquear su reutilización) o null. Comparación
 * en tiempo constante y sin cortocircuito para no filtrar por tiempo.
 */
export function verifyTotp(
  secretB32: string,
  code: string,
  { window = 1, now = Date.now() }: { window?: number; now?: number } = {}
): number | null {
  const limpio = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(limpio)) return null;
  const secret = base32Decode(secretB32);
  if (secret.length < 10) return null;
  const actual = totpStep(now);
  let acierto: number | null = null;
  for (let d = -window; d <= window; d++) {
    const step = actual + d;
    const esperado = hotp(secret, step);
    if (timingSafeEqual(Buffer.from(esperado), Buffer.from(limpio))) acierto = step;
  }
  return acierto;
}

/** URI `otpauth://totp/...` que las apps convierten en una entrada al escanearlo. */
export function otpauthUri({ issuer, account, secret }: { issuer: string; account: string; secret: string }): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const q = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}
