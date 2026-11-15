#!/bin/sh
# Восстановление тома данных из бэкапа, созданного backup.sh.
# Использование: ./scripts/restore.sh backups/healthosted-2026-11-14_2130.tar.gz
set -eu

ARCHIVE="${1:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
VOLUME="${VOLUME:-healthosted_data}"

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Укажи существующий архив: ./scripts/restore.sh backups/…tar.gz" >&2
  exit 1
fi

echo "ВНИМАНИЕ: данные тома '$VOLUME' будут перезаписаны."
printf "Продолжить? введи 'yes': "
read -r answer
[ "$answer" = "yes" ] || { echo "отменено"; exit 1; }

echo "[restore] останавливаю приложение"
docker compose -f "$COMPOSE_FILE" stop app

echo "[restore] распаковываю $ARCHIVE в том $VOLUME"
docker run --rm \
  -v "${VOLUME}:/data" \
  -v "$(cd "$(dirname "$ARCHIVE")" && pwd):/backup:ro" \
  alpine:3.20 \
  sh -c "rm -rf /data/* && tar xzf '/backup/$(basename "$ARCHIVE")' -C /data"

echo "[restore] запускаю приложение"
docker compose -f "$COMPOSE_FILE" start app

echo "[restore] готово. Проверь: ./scripts/smoke.sh"
