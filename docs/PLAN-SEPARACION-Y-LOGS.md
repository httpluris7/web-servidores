# Plan: separar correo y provisioner del host web (0-02) y logging fuera del host

Documento de decisión para el hallazgo 0-02 de la auditoría del 2026-09-03 y el punto
"logging off-host". No se ha cambiado nada: es una propuesta con pasos, coste y riesgo.

## Situación actual (2026-09-05)

Un solo host (`mail.viahost.top`, 45.136.213.194, 60 GB RAM, 877 GB disco, ~3 % usado) concentra:

| Pieza | Puertos públicos | Notas |
|---|---|---|
| Web viahost.top (Next.js + pm2) | 80/443 vía Cloudflare; origen cerrado a IPs de CF | :3000 solo loopback |
| Correo (Postfix, Dovecot, Rspamd, Roundcube, MariaDB) | 25, 465, 587, 143, 993, 443 (webmail) | 12 MB de buzones; MX y PTR apuntan a esta IP |
| Provisioner (Docker: API, worker, Postgres, Redis) | ninguno (API en 127.0.0.1:8080) | habla con Proxmox nl-ams y Alemania |
| DNS autoritativo (53) | 53 | ns1/ns2 |

El bloque asignado es **45.136.213.192/29**: además de la .194 hay **cuatro IPs libres** (.195 a .198) ya
configuradas en la interfaz. Es lo que hace barata la separación.

Riesgos de tenerlo junto: (1) el correo obliga a exponer 443 y 25 en la misma IP que sirve la web, así que
el origen web no puede cerrarse por firewall, solo por nginx; (2) un compromiso del correo (Roundcube es la
superficie más grande) da acceso al mismo host donde viven `.env`, los datos de clientes y el provisioner;
(3) un reinicio o incidente de cualquiera tumba a los tres.

## Opciones

### A. Correo a su propia VM en el Proxmox de Holanda, con IP dedicada (recomendada)
- Nueva VM (2 vCPU, 4 GB, 40 GB) en blade6-2 con una de las IPs libres del bloque, p. ej. **45.136.213.195**
  (o una IP del pool de nl-ams, pero entonces cambia la reputación: mejor conservar el bloque).
- Migración: instalar Postfix/Dovecot/Rspamd/Roundcube/MariaDB desde los backups del módulo
  (`viahost-dumps` ya vuelca MariaDB y el Maildir cada hora), copiar `/etc/postfix`, `/etc/dovecot`,
  `/etc/rspamd`, certificados y DKIM (misma clave → el selector no cambia), `rsync` del Maildir.
- DNS: `mail.viahost.top` A → nueva IP; MX no cambia (apunta al nombre); **PTR** de la nueva IP →
  `mail.viahost.top` (lo pone el proveedor del bloque); SPF: añadir la nueva IP durante la transición y
  quitar la vieja después.
- Corte: 10–15 min de rechazo temporal (Postfix en el host viejo con `soft_bounce = yes` durante el cambio
  de DNS; los remitentes reintentan). Rollback: volver el A y PTR a la .194.
- Después: en el host web se cierran 25/465/587/143/993, se retira Roundcube, y el origen web puede cerrarse
  **por firewall** a las IPs de Cloudflare (hoy solo por nginx).
- Coste: 0 € (recursos propios). Esfuerzo: medio día con pruebas.

### B. Provisioner a su propia VM
- VM pequeña (2 vCPU, 2 GB) en blade6-2 o en el propio host como VM aparte. Solo la web habla con él, por
  la red privada del nodo o por wireguard; Postgres y Redis se mueven con `pg_dump` + `redis` vacío.
- Ventaja: el token de Proxmox y la base de datos de clientes salen del host web.
- Contra: la web y el provisioner ya están aislados por Docker y loopback; la ganancia es menor que la de A.
- Coste: 0 €. Esfuerzo: medio día.

### C. Mínimo sin mover nada: IP dedicada para el correo en el mismo host
- Ligar Postfix/Dovecot/webmail a la **.195** y la web a la .194; entonces sí se puede cerrar la .194 por
  firewall a Cloudflare y dejar la .195 abierta solo para correo.
- No separa hosts (un compromiso del correo sigue en la misma máquina), pero elimina el riesgo (1) en una hora
  de trabajo y sin migración. Es compatible con hacer A más adelante.

**Recomendación:** C ahora (barato, sin corte) y A cuando haya una ventana; B solo si se quiere que el host
web quede sin ningún secreto de infraestructura.

## Logging fuera del host

Objetivo: que un atacante que borre logs en el host no borre la evidencia, y tener alertas.

| Opción | Coste | Esfuerzo | Notas |
|---|---|---|---|
| **journald-remote a una VM propia** en blade6-2 (`systemd-journal-remote` + TLS) | 0 € | 2–3 h | Todo en casa; hay que vigilar disco y retención en esa VM |
| **Grafana Cloud (free)** con Alloy/Promtail enviando journald + nginx + pm2 | 0 € hasta 50 GB/mes | 2 h | Dashboards y alertas incluidos; datos en un tercero (UE seleccionable) |
| **Papertrail/Better Stack** vía rsyslog TLS | ~7–10 €/mes | 1 h | Lo más simple; retención corta en el plan básico |

**Recomendación:** Grafana Cloud free con retención de 14 días para journald, nginx (`access`/`error`),
fail2ban y los logs de pm2, y alertas por correo para: fallos de login SSH repetidos, errores 5xx de nginx,
y "SERVICIO BORRADO por impago" del módulo de renovaciones. Si se prefiere no depender de terceros, la
VM con journald-remote.

## Qué necesito para ejecutar

- Opción C: solo autorización (se hace en este host, con backup de `main.cf`, `dovecot.conf` y nginx).
- Opción A: autorización, el PTR de la IP elegida en el panel del proveedor del bloque, y una ventana de
  15 min para el cambio de DNS.
- Logging: elegir opción; para Grafana Cloud, una cuenta (correo) y el token de escritura que genere.
