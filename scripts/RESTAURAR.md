# Recuperación ante desastre — viahost-web

Cómo revivir el servicio en un servidor nuevo a partir de una copia de
seguridad, si el original se avería o perdemos el acceso.

Las copias las genera el módulo de **Copias de seguridad** del panel
(`/admin/backups`): un `.vhbk` cifrado (AES-256-GCM) que contiene todo `data/`
y el `.env`. El código NO va dentro (está en git); se repone con `git clone`.

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
```

La frase también puede ir en la variable `BACKUP_PASSPHRASE`; si no se pasa por
ningún lado, el script la pide por teclado.

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
