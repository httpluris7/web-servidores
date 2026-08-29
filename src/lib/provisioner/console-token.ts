import { createHmac } from "crypto";

/**
 * Firma el token de consola que viaja en la query del websocket `/console-ws`
 * del provisioner. El provisioner lo verifica con `verifyConsoleToken` usando el
 * MISMO secreto (`PROVISIONER_API_TOKEN` en la web == `INTERNAL_API_TOKEN` en el
 * provisioner). El formato es `base64url(JSON).base64url(HMAC-SHA256)` y DEBE
 * coincidir campo a campo con el verificador del provisioner.
 *
 * Solo servidor: el secreto no puede llegar nunca al navegador. El token lleva
 * el `port` y el `ticket` de una llamada previa a `vncproxy`, así que el proxy
 * no decide a qué VM conectar: solo abre la consola que la web ya autorizó.
 */
export function signConsoleToken(
  claims: { vpsId: number; port: string | number; ticket: string },
  ttlMs = 60_000,
): string {
  const secret = process.env.PROVISIONER_API_TOKEN;
  if (!secret) throw new Error("PROVISIONER_API_TOKEN no configurado");

  const payload = {
    vpsId: claims.vpsId,
    port: String(claims.port),
    ticket: claims.ticket,
    exp: Date.now() + ttlMs,
  };
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}
