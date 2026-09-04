#!/usr/bin/env bash
#
# restaurar-dumps.sh — carga en el servidor los volcados que `restaurar.mjs` deja
# en `restaurar-dumps/` (vienen de /usr/local/sbin/viahost-dumps en el original):
#
#   mariadb-all.sql.gz     → MariaDB (todas las BBDD: mailserver, roundcube, mysql…)
#   provisioner-pg.sql.gz  → Postgres del provisioner (contenedor docker)
#   maildir.tar.gz         → /var/mail/vhosts (Maildir de Dovecot)
#
# ES DESTRUCTIVO: sobrescribe BBDD y buzones existentes. Por eso primero muestra
# el plan y solo actúa con `--yes`. Ejecutar como root.
#
# Uso:
#   sudo bash scripts/restaurar-dumps.sh <carpeta-con-volcados> [--yes] [--solo mariadb|postgres|maildir]
#
# Variables opcionales (sirven también para PROBAR una restauración en aislado,
# p.ej. contra contenedores desechables, sin tocar el servidor real):
#   MYSQL_CMD        comando cliente MariaDB     (def. "mysql")
#   PG_CONTAINER     contenedor Postgres         (def. viahost-provisioner-postgres-1)
#   PG_USER / PG_DB  usuario y BBDD de Postgres  (def. provisioner / provisioner)
#   MAILDIR_PARENT   carpeta donde extraer el Maildir (def. /var/mail → crea /var/mail/vhosts)
#   MAILDIR_OWNER    propietario a aplicar tras extraer (def. vmail:vmail; "" = dejar numéricos)

set -euo pipefail

DIR="${1:-}"; shift || true
YES=0; SOLO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1 ;;
    --solo) SOLO="${2:-}"; shift ;;
    *) echo "✗ argumento desconocido: $1" >&2; exit 2 ;;
  esac
  shift
done
[ -n "$DIR" ] && [ -d "$DIR" ] || { echo "✗ indica la carpeta con los volcados (restaurar-dumps/)" >&2; exit 2; }

MYSQL_CMD="${MYSQL_CMD:-mysql}"
PG_CONTAINER="${PG_CONTAINER:-viahost-provisioner-postgres-1}"
PG_USER="${PG_USER:-provisioner}"
PG_DB="${PG_DB:-provisioner}"
MAILDIR_PARENT="${MAILDIR_PARENT:-/var/mail}"
MAILDIR_OWNER="${MAILDIR_OWNER-vmail:vmail}"

quiere() { [ -z "$SOLO" ] || [ "$SOLO" = "$1" ]; }

echo "▸ Volcados en $DIR:"
[ -f "$DIR/dumps-info.json" ] && sed 's/^/    /' "$DIR/dumps-info.json"
echo "▸ Plan:"
quiere mariadb  && [ -f "$DIR/mariadb-all.sql.gz" ]    && echo "    · MariaDB  ← mariadb-all.sql.gz    (via: $MYSQL_CMD)"
quiere postgres && [ -f "$DIR/provisioner-pg.sql.gz" ] && echo "    · Postgres ← provisioner-pg.sql.gz (contenedor $PG_CONTAINER, $PG_USER/$PG_DB)"
quiere maildir  && [ -f "$DIR/maildir.tar.gz" ]        && echo "    · Maildir  ← maildir.tar.gz        (en $MAILDIR_PARENT/vhosts, owner ${MAILDIR_OWNER:-numérico})"
if [ "$YES" -ne 1 ]; then
  echo
  echo "Nada hecho. Esto SOBRESCRIBE las BBDD y los buzones del servidor: repite con --yes para ejecutarlo."
  exit 0
fi

fallos=0

# ---- MariaDB ----
if quiere mariadb && [ -f "$DIR/mariadb-all.sql.gz" ]; then
  echo "▸ MariaDB: cargando…"
  # --all-databases incluye la BBDD `mysql` (usuarios/grants); tras cargarla hay que FLUSH PRIVILEGES.
  if gzip -dc "$DIR/mariadb-all.sql.gz" | $MYSQL_CMD && $MYSQL_CMD -e "FLUSH PRIVILEGES"; then
    echo "  ✓ MariaDB restaurada: $($MYSQL_CMD -Nse "SELECT GROUP_CONCAT(schema_name) FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema','performance_schema','sys','mysql')")"
  else
    echo "  ✗ MariaDB FALLÓ"; fallos=1
  fi
fi

# ---- Postgres ----
if quiere postgres && [ -f "$DIR/provisioner-pg.sql.gz" ]; then
  echo "▸ Postgres: cargando en $PG_CONTAINER…"
  # El volcado lleva --clean --if-exists: borra y recrea cada objeto. Se para en el primer error.
  if gzip -dc "$DIR/provisioner-pg.sql.gz" | docker exec -i "$PG_CONTAINER" psql -q -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" >/dev/null; then
    echo "  ✓ Postgres restaurado: $(docker exec "$PG_CONTAINER" psql -Atc "SELECT count(*)||' tablas' FROM pg_tables WHERE schemaname='public'" -U "$PG_USER" -d "$PG_DB")"
  else
    echo "  ✗ Postgres FALLÓ"; fallos=1
  fi
fi

# ---- Maildir ----
if quiere maildir && [ -f "$DIR/maildir.tar.gz" ]; then
  echo "▸ Maildir: extrayendo en $MAILDIR_PARENT/vhosts…"
  mkdir -p "$MAILDIR_PARENT"
  if tar --numeric-owner -xzpf "$DIR/maildir.tar.gz" -C "$MAILDIR_PARENT"; then
    if [ -n "$MAILDIR_OWNER" ] && id "${MAILDIR_OWNER%%:*}" >/dev/null 2>&1; then
      chown -R "$MAILDIR_OWNER" "$MAILDIR_PARENT/vhosts"
    fi
    echo "  ✓ Maildir restaurado: $(find "$MAILDIR_PARENT/vhosts" -type f | wc -l) ficheros"
  else
    echo "  ✗ Maildir FALLÓ"; fallos=1
  fi
fi

[ "$fallos" -eq 0 ] && echo "✓ Volcados cargados." || echo "✗ Hubo fallos (ver arriba)."
exit "$fallos"
