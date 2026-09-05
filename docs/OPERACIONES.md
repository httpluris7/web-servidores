# Operaciones de viahost.top — guía rápida

Resumen de cómo funcionan las piezas automatizadas de la web y qué hacer en cada caso.
Todo está en `/home/user3100/web-servidores` (web, Next.js + pm2 como usuario `viahost`)
y `/home/user3100/viahost-provisioner` (API + worker en Docker, Proxmox).

## Despliegue

- Web: `/usr/local/bin/viahost-deploy` (build + reinicio de pm2 + comprobación). Nunca `next build` a secas.
  Cada deploy genera un `deploymentId`: los navegadores con una pestaña vieja recargan solos.
- Provisioner: `cd viahost-provisioner && docker compose build && docker compose up -d`
  (aplica migraciones de la base de datos antes de arrancar). Comprobar que no hay pedidos en cola.
- Tests unitarios: `npm test` en ambos proyectos.

## Acceso y seguridad

- SSH: solo `user3100` por clave; root no entra. Para administrar: `sudo -i`. Claude Code vive en `/root`.
- 2FA obligatorio para el admin de la web. Rescate si pierde el móvil: como root, borrar su uid de
  `data/mfa.json` y volver a darse de alta en `/cuenta#2fa`.
- Cloudflare: WAF (Managed + OWASP en block). Rollback OWASP: `bash /root/cf-owasp-block.sh --log`
  (necesita token con Zone WAF:Edit en `/root/.cf-token`; borrarlo y revocarlo al terminar).
- CSP bloqueante en `next.config.ts`. Si una integración nueva carga scripts/iframes externos, añadir su origen.

## Catálogo y planes

- Los planes VPS (disco, RAM, vCores, precio) se editan en `/admin/catalogo`. Al guardar se sincronizan
  solos con el provisioner; el botón "Sincronizar con el provisioner" fuerza una pasada completa y
  muestra diferencias. Un plan nuevo se crea en el provisioner en ese mismo momento, con su
  disponibilidad por ubicación (plan global = regiones con `provisionLocation` sin gama propia; plan
  exclusivo = solo su región). Ya no hace falta `seed:plans`; un plan retirado del catálogo no se borra
  del provisioner (lo siguen usando los VPS creados con él).
- Cambio de plan desde el panel de cliente: ampliar = proforma por la diferencia mensual, se aplica al
  pagar; reducir = inmediato y gratis, el disco nunca se reduce.

## Renovaciones e impagos (`/admin/configuracion` → Renovaciones)

- Cada VPS o cuenta de hosting cubre un mes desde el pago del alta; cada renovación pagada suma un mes.
- 7 días antes de vencer (configurable): proforma de renovación por transferencia al precio actual del plan.
- Al vencer sin pagar: correo de aviso al cliente.
- 3 días después (configurable) sin pago: el servicio se suspende y se ELIMINA (VM destruida / cuenta cPanel
  eliminada), la proforma se cancela y se avisa. Irreversible. Se puede desactivar con el interruptor
  "Suspender y borrar".
- "Vista previa de vencimientos" muestra qué se emitiría hoy; "Emitir renovaciones ahora" ejecuta el barrido
  a mano. Tras cada barrido con actividad llega un resumen al buzón de avisos.
- Datos: `data/renovaciones-vps.jsonl`, `data/plan-changes.jsonl` (incluidos en las copias de seguridad).

## Avisos por umbral (`/admin/configuracion` → Avisos)

- CPU, memoria y disco salen de las métricas del agente; "agente sin enviar" del silencio del agente.
- **Tráfico v4vm**: cada 5 min se apuntan los contadores acumulados de la API del proveedor en
  `data/trafico.json` y se avisa cuando entrada+salida de las últimas 24 h supera el umbral (GB).
  Necesita 12 h de historial; se resuelve al bajar un 10 % del umbral. Cubre también servidores del
  proveedor sin ficha (en el listado salen enlazados al inventario). 0 desactiva la regla.

## Copias de seguridad de los clientes

- Cada cliente programa copias automáticas (diarias/semanales, hora UTC, retención) desde su panel; las
  ejecuta el worker del provisioner y solo rota las copias etiquetadas `viahost-auto`.
- Restaurar una copia sobrescribe la VM (queda apagada); requiere teclear el nombre del servidor.

## Dónde mirar cuando algo falla

- Web: `pm2 logs viahost-web` (como viahost, `PM2_HOME=/var/lib/viahost/.pm2`).
- Provisioner: `docker compose logs -f app worker`.
- Cloudflare: Security → Events (WAF), y `Security → WAF → Managed rules` para el OWASP.
- Correo saliente: `/var/log/mail.log`; buzones en `/var/mail/vhosts/viahost.top/<buzón>/`.
