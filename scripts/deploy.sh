#!/usr/bin/env bash
#
# Deploy de viahost-web: reconstruye y reinicia pm2 de forma atómica.
#
# El bug que esto evita: si reconstruyes (`next build`) sin reiniciar el proceso,
# el servidor en marcha sigue apuntando a chunks de JS antiguos que el build
# acaba de sobrescribir -> el navegador recibe 404 en el JS -> "Application
# error: a client-side exception". Por eso build y restart van SIEMPRE juntos.
#
# Salvaguarda: si el build falla, NO se reinicia (el sitio actual sigue vivo).
#
# Uso:   ./scripts/deploy.sh        (o: npm run deploy)
# Config opcional por entorno:
#   PM2_APP   nombre del proceso pm2   (def. viahost-web)
#   PORT      puerto a comprobar       (def. 3000)
#   HEALTH_TIMEOUT  segundos de espera (def. 30)

set -euo pipefail

PM2_APP="${PM2_APP:-viahost-web}"
PORT="${PORT:-3000}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"

# Situarse en la raíz del proyecto (carpeta padre de este script).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "▸ Deploy de '$PM2_APP' desde $ROOT"

# 0) Comprobaciones previas.
command -v pm2 >/dev/null 2>&1 || { echo "✗ pm2 no está instalado."; exit 1; }
if ! pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  echo "✗ El proceso pm2 '$PM2_APP' no existe. Arráncalo primero (pm2 start npm --name $PM2_APP -- start)."
  exit 1
fi

# 1) Build. Si falla, abortamos sin tocar el servidor en marcha.
echo "▸ next build…"
if ! npm run build; then
  echo "✗ Build fallido. NO se reinicia: el sitio actual sigue sirviéndose."
  exit 1
fi

# 2) Reinicio del proceso para que cargue el build nuevo (chunks frescos).
echo "▸ Reiniciando pm2 '$PM2_APP'…"
pm2 restart "$PM2_APP" --update-env

# 3) Health check: esperar a que el puerto responda 200.
echo "▸ Esperando a que :$PORT responda (máx ${HEALTH_TIMEOUT}s)…"
ok=0
for ((i = 1; i <= HEALTH_TIMEOUT; i++)); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then
    echo "✓ Online en :$PORT (HTTP $code) tras ${i}s."
    ok=1
    break
  fi
  sleep 1
done

if [ "$ok" -ne 1 ]; then
  echo "✗ El sitio no respondió 200 en ${HEALTH_TIMEOUT}s. Revisa: pm2 logs $PM2_APP"
  exit 1
fi

# 4) Persistir la lista de procesos pm2 (sobrevive a reinicios del servidor).
pm2 save >/dev/null 2>&1 || true

echo "✓ Deploy completado."
