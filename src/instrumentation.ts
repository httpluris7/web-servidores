/**
 * Arranque del proceso servidor (Next llama a `register()` una vez al iniciar).
 *
 * El trabajo de verdad vive en `instrumentation-node.ts` y se carga solo bajo
 * esta condición, escrita EXACTAMENTE así a propósito: `register` se compila
 * también para el runtime edge, y ahí no existen `node:child_process` ni
 * `node:crypto`, que es lo que acaba arrastrando el envío de correo. Con la
 * comprobación en esta forma, el empaquetador descarta la rama entera en el
 * bundle edge; con un `if (… !== "nodejs") return` antes del import, no lo
 * hace y el build falla con «UnhandledSchemeError».
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
