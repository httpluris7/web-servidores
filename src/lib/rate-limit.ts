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

/**
 * Tope duro de claves vivas.
 *
 * Varias claves incluyen datos que elige quien llama (el email en el login, el
 * id del servidor en su panel). Sin tope, basta con variar ese dato en cada
 * petición para hacer crecer el Map indefinidamente: la poda perezosa solo
 * borra lo caducado, y dentro de la ventana no hay nada caducado. Por encima
 * del tope desalojamos las entradas que antes vencen —las que menos protegen ya—
 * para que la memoria quede acotada pase lo que pase.
 */
const MAX_KEYS = 5000;

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
  if (store.size > MAX_KEYS) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
    // Si sigue por encima, es que están todas vivas: alguien está fabricando
    // claves. Desalojamos por vencimiento más próximo hasta volver al tope.
    if (store.size > MAX_KEYS) {
      const porVencimiento = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
      for (const [k] of porVencimiento.slice(0, store.size - MAX_KEYS)) store.delete(k);
    }
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
 * IP del cliente a partir de las cabeceras del proxy inverso.
 *
 * Detrás de nuestro nginx, que fija `X-Real-IP = $remote_addr` (la IP TCP real
 * del cliente, NO falsificable). La usamos como fuente principal. NO se usa la
 * primera IP de `X-Forwarded-For`: esa la pone el propio cliente y es spoofable
 * (rotándola se evadía el rate-limit de login). Como respaldo se toma la
 * ÚLTIMA IP de XFF (la añade el proxy más cercano), no la primera.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    return parts[parts.length - 1]!.trim();
  }
  return "unknown";
}
