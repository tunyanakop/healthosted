#!/bin/sh
# Бэкап тома данных HealtHosted.
# Останавливает контейнер на несколько секунд, чтобы SQLite был консистентен.
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
VOLUME="${VOLUME:-healthosted_data}"
STAMP="$(date +%Y-%m-%d_%H%M)"
TARGET="healthosted-${STAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] stopping app"
docker compose -f "$COMPOSE_FILE" stop app

echo "[backup] archiving volume $VOLUME -> $BACKUP_DIR/$TARGET"
docker run --rm \
  -v "${VOLUME}:/data:ro" \
  -v "$(cd "$BACKUP_DIR" && pwd):/backup" \
  alpine:3.20 \
  tar czf "/backup/${TARGET}" -C /data .

echo "[backup] starting app"
docker compose -f "$COMPOSE_FILE" start app

echo "[backup] done: $BACKUP_DIR/$TARGET"
echo "[backup] сохрани копию вне этого сервера — том и бэкап на одном диске не спасают"
