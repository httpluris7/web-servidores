import { barrerAgentesCaidos } from "@/lib/servidores/avisos";

/**
 * Único trabajo periódico de la aplicación: buscar agentes que han dejado de
 * enviar métricas. Esa comprobación no puede colgarse de la ingesta, porque el
 * síntoma es justamente que no llega ninguna petición.
 *
 * Un `setInterval` en el proceso basta para esto: pm2 corre una sola instancia
 * en modo fork, así que no hay dos procesos que se pisen, y si el proceso se
 * reinicia el intervalo se rearma solo. El estado de los avisos está en disco,
 * no aquí, de modo que un despliegue no reavisa de lo que ya estaba abierto.
 *
 * Si algún día esto crece a varias réplicas, el barrido tendría que salir a un
 * cron externo con un candado compartido; mientras tanto, añadir una
 * dependencia de planificación sería más pieza que problema.
 *
 * Este módulo solo se carga en el runtime nodejs (ver `instrumentation.ts`).
 */

/** Cada cuánto se buscan agentes caídos. */
const BARRIDO_MS = 5 * 60_000;

/** Margen antes del primer barrido, para no competir con el arranque. */
const ESPERA_INICIAL_MS = 60_000;

const lanzar = () => {
  void barrerAgentesCaidos();
};

// `unref` para que un temporizador pendiente no mantenga vivo el proceso
// cuando pm2 le pida cerrar.
setTimeout(() => {
  lanzar();
  setInterval(lanzar, BARRIDO_MS).unref();
}, ESPERA_INICIAL_MS).unref();
