#!/bin/sh
# A fresh database/app container for every browser run; the shared PG host is disposable.
set -eu
: "${UI_PG_CONTAINER:?set the disposable PostgreSQL container name}"
: "${UI_NETWORK:?set its isolated Docker network}"
: "${UI_IMAGE:?build the test app image first}"
ui_database="ui_$(date +%s)_$$"
ui_container="lazypos-ui-$ui_database"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cleanup() {
  docker stop "$ui_container" >/dev/null 2>&1 || true
  docker exec "$UI_PG_CONTAINER" dropdb -U postgres --if-exists "$ui_database" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
docker exec "$UI_PG_CONTAINER" createdb -U postgres "$ui_database"
docker run --rm -d --name "$ui_container" --network "$UI_NETWORK" -p 127.0.0.1::8080 \
  -e "DATABASE_URL=postgres://postgres:tab24-local@$UI_PG_CONTAINER/$ui_database" "$UI_IMAGE" >/dev/null
ui_port=$(docker port "$ui_container" 8080/tcp | sed 's/.*://')
export UI_BASE="http://127.0.0.1:$ui_port" UI_DATABASE="$ui_database"
for attempt in $(seq 1 100); do
  if curl -fsS "$UI_BASE/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
node "$script_dir/checkout-browser.cjs"
