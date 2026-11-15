#!/bin/sh
# Быстрая проверка живого сервиса. Запуск: ./scripts/smoke.sh [base-url]
set -eu

BASE="${BASE:-${1:-http://127.0.0.1:3000}}"
fail=0

check() {
  label="$1"
  expected="$2"
  actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ok    %-28s %s\n' "$label" "$actual"
  else
    printf '  FAIL  %-28s %s (ожидалось %s)\n' "$label" "$actual" "$expected"
    fail=1
  fi
}

echo "HealtHosted smoke: $BASE"

health_body=$(curl -fsS "$BASE/api/health" || echo '{"status":"error"}')
printf '  health body: %s\n' "$health_body"

check "GET /api/health" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health")"
check "GET /login" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login")"
check "GET /dashboard без сессии" "307" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dashboard")"
check "GET /api/me без сессии" "401" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/me")"
check "GET /api/export без сессии" "401" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/export")"

if [ "$fail" -ne 0 ]; then
  echo "smoke: есть ошибки"
  exit 1
fi

echo "smoke: всё живо"
