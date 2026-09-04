# Recuperación ante desastre — viahost-web

Cómo revivir el servicio en un servidor nuevo a partir de una copia de
seguridad, si el original se avería o perdemos el acceso.

Las copias las genera el módulo de **Copias de seguridad** del panel
(`/admin/backups`): un `.vhbk` cifrado (AES-256-GCM) que contiene todo `data/`,
el `.env` y, desde 2026-09-04, los **volcados del host** que deja root cada hora
en `/var/backups/viahost-dumps/` (`/usr/local/sbin/viahost-dumps`, timer
`viahost-dumps.timer`): MariaDB completo (`mailserver` + `roundcube`), el
Postgres del provisioner y el Maildir de Dovecot. El código NO va dentro (está
en git); se repone con `git clone`.

## Qué hace falta a mano

- **La frase de cifrado** del backup (la que se puso en el panel). Sin ella el
  `.vhbk` es ilegible: guárdala en un gestor de contraseñas, no solo en el
  servidor.
- **Acceso a una copia**: un `.vhbk` descargado, o las credenciales del destino
  (token de Dropbox / clave del SFTP) para que el script baje la última.

## Procedimiento

```sh
# 1. Traer el código
git clone <repo> web-servidores && cd web-servidores

# 2. Reponer data/ y .env desde la copia (elige una fuente):

#    a) desde un fichero .vhbk que ya tienes
node scripts/restaurar.mjs ./viahost-backup-2026-08-31T0300Z.vhbk --passphrase '••••'

#    b) la última copia de Dropbox (app con refresh token, recomendado)
node scripts/restaurar.mjs --dropbox \
  --dropbox-refresh <REFRESH> --dropbox-key <APP_KEY> --dropbox-secret <APP_SECRET> \
  --dropbox-folder /viahost-backups --passphrase '••••'
#       (o con un token de acceso directo: --dropbox-token <TOKEN>)

#    c) la última copia del SFTP
node scripts/restaurar.mjs --sftp \
  --sftp-host <HOST> --sftp-user <USER> --sftp-key ./id_backup \
  --sftp-dir viahost-backups --passphrase '••••'

# 3. Levantar la app
npm ci && npm run deploy

# 4. BBDD y correo (como root; primero SIN --yes para ver el plan)
#    Requiere MariaDB, docker (contenedor Postgres del provisioner) y Dovecot ya instalados.
sudo bash scripts/restaurar-dumps.sh ./restaurar-dumps
sudo bash scripts/restaurar-dumps.sh ./restaurar-dumps --yes
#    (--solo mariadb|postgres|maildir para cargar solo una parte)
```

La frase también puede ir en la variable `BACKUP_PASSPHRASE`; si no se pasa por
ningún lado, el script la pide por teclado.

## Volcados de BBDD y correo (hallazgo 7-01)

- `restaurar.mjs` NO aplica los volcados: los deja en `restaurar-dumps/`
  (`mariadb-all.sql.gz`, `provisioner-pg.sql.gz`, `maildir.tar.gz`,
  `dumps-info.json` con fecha y estado de cada uno). Cargarlos es destructivo y
  lo hace `restaurar-dumps.sh` como root, solo con `--yes`.
- El volcado de MariaDB incluye la BBDD `mysql` (usuarios y permisos, entre ellos
  los de Postfix/Dovecot/Roundcube); el script hace `FLUSH PRIVILEGES` al acabar.
- El de Postgres lleva `--clean --if-exists`: recrea las tablas del provisioner
  (`orders`, `vps`, `delivery_tokens`, `locations`…) en el contenedor
  `viahost-provisioner-postgres-1`, que debe estar levantado (`docker compose up
  -d postgres` en `viahost-provisioner`).
- El Maildir se extrae en `/var/mail/vhosts` con propietarios numéricos y luego
  `chown vmail:vmail`.
- Los volcados se renuevan cada hora (minuto 50); la copia diaria de las 03:00
  lleva volcados de ≤10 min. El panel muestra la antigüedad en la columna
  "BBDD+correo" del histórico; "incompleto" = faltó algún volcado.
- **Restauración PROBADA el 2026-09-04** en aislado (contenedores MariaDB 10.11 y
  Postgres 16 desechables + Maildir en carpeta temporal) a partir de un `.vhbk`
  real: tablas, filas y ficheros de correo coincidían con producción. Para
  repetir la prueba sin tocar el servidor real:
  ```sh
  MYSQL_CMD="docker exec -i mariadb-prueba mariadb -uroot -pXXX" PG_CONTAINER=pg-prueba \
  MAILDIR_PARENT=/tmp/mail-prueba MAILDIR_OWNER="" \
    bash scripts/restaurar-dumps.sh ./restaurar-dumps --yes
  ```

## Notas

- El script es autocontenido (solo Node): no necesita `node_modules` ni el build
  para restaurar.
- Por seguridad no sobrescribe un `data/` que ya tenga contenido salvo que se le
  pase `--force`.
- El formato de descifrado está duplicado a propósito en `scripts/restaurar.mjs`
  y en `src/lib/backup/cifrado.ts`. Si se cambia uno, hay que cambiar el otro o
  las copias viejas dejarán de poder restaurarse.
- Tras restaurar, revisa que `ADMIN_EMAILS` y las claves de sesión del `.env`
  son las esperadas y que el DNS/nginx apuntan al servidor nuevo.
