/**
 * Rate limiting en memoria (ventana fija), sin dependencias externas.
 *
 * Suficiente para la escala actual: un único proceso pm2 (fork). No sobrevive a
 * reinicios ni se comparte entre instancias; si algún día se escala a varias
 * réplicas habría que mover el contador a Redis. Falla en abierto: cualquier
 * problema interno nunca debe bloquear a un usuario legítimo.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfter: number };

/**
 * Registra un intento para `key` y dice si se permite. Cuando se superan
 * `limit` intentos dentro de `windowMs`, devuelve `ok: false` con los segundos
 * que faltan para que la ventana se reinicie (`retryAfter`).
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();

  // Poda perezosa para que el Map no crezca sin límite.
  if (store.size > 5000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
  }

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * IP del cliente a partir de las cabeceras del proxy inverso. Toma la primera
 * IP de `x-forwarded-for`; si no hay, cae a `x-real-ip` y, en último término, a
 * "unknown" (las claves de login combinan IP+email, así que aun sin IP fiable
 * el límite por email sigue protegiendo frente a fuerza bruta dirigida).
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
