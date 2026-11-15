#!/bin/sh
set -eu

: "${DATA_DIR:=/data}"
: "${DATABASE_URL:=file:${DATA_DIR}/app.db}"
: "${PORT:=3000}"

export DATA_DIR DATABASE_URL PORT

mkdir -p "$DATA_DIR/uploads"

echo "[entrypoint] database: $DATABASE_URL"
echo "[entrypoint] applying migrations"
npx --no-install prisma migrate deploy

echo "[entrypoint] starting HealtHosted on 0.0.0.0:$PORT"
exec npx --no-install next start -H 0.0.0.0 -p "$PORT"
