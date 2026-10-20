#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"

ACTION="deploy"
ENV_FILE="${SCRIPT_DIR}/.env.prod"

if [[ $# -ge 1 ]]; then
  case "$1" in
    deploy|rollback|seed)
      ACTION="$1"
      shift
      ;;
    *)
      ENV_FILE="$1"
      shift
      ;;
  esac
fi

if [[ $# -ge 1 ]]; then
  ENV_FILE="$1"
  shift
fi

if [[ $# -gt 0 ]]; then
  echo "Uzycie:"
  echo "  ./deploy.sh [deploy|rollback|seed] [sciezka-do-env]"
  echo "Przyklady:"
  echo "  ./deploy.sh"
  echo "  ./deploy.sh deploy deploy/.env.prod"
  echo "  ./deploy.sh seed deploy/.env.prod"
  echo "  ./deploy.sh rollback deploy/.env.prod"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Brak pliku env: ${ENV_FILE}"
  echo "Skopiuj ${SCRIPT_DIR}/.env.prod.example -> ${SCRIPT_DIR}/.env.prod i uzupelnij hasla."
  exit 1
fi

dotenv_get() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n1 | cut -d '=' -f2- || true)"
  echo "${value}"
}

require_env() {
  local key="$1"
  local value
  value="$(dotenv_get "${key}")"
  if [[ -z "${value}" ]]; then
    echo "Brak ${key} w ${ENV_FILE}"
    exit 1
  fi
}

PROJECT_NAME="$(dotenv_get COMPOSE_PROJECT_NAME)"
PROJECT_NAME="${PROJECT_NAME:-rallygallery}"
WEB_IMAGE="${PROJECT_NAME}_web:current"
WEB_ROLLBACK_IMAGE="${PROJECT_NAME}_web:rollback"
WEB_BIND_PORT_VALUE="$(dotenv_get WEB_BIND_PORT)"
WEB_BIND_PORT_VALUE="${WEB_BIND_PORT_VALUE:-18082}"

compose() {
  docker compose \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

backup_current_image() {
  if docker image inspect "${WEB_IMAGE}" >/dev/null 2>&1; then
    docker image tag "${WEB_IMAGE}" "${WEB_ROLLBACK_IMAGE}"
    echo "Zapisano rollback: ${WEB_ROLLBACK_IMAGE}"
  else
    echo "Brak obrazu do rollbacku: ${WEB_IMAGE}"
  fi
}

cleanup_unused_containers() {
  echo "Cleanup nieuzywanych kontenerow starszych niz 24h"
  docker container prune --force --filter "until=24h"
}

run_migrations() {
  echo "Migracje bazy"
  compose --profile tools run --rm migrate
}

resolve_app_version() {
  local root version sha
  root="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
  version="$(sed -n 's/^  "version": "\([^"]*\)".*/\1/p' "${root}/package.json" | head -n1)"
  version="${version:-dev}"
  sha="$(git -C "${root}" rev-parse --short HEAD 2>/dev/null || true)"
  if [[ -n "${sha}" ]]; then
    export APP_VERSION="${version} (${sha})"
  else
    export APP_VERSION="${version}"
  fi
}

run_deploy() {
  require_env POSTGRES_USER
  require_env POSTGRES_PASSWORD
  require_env POSTGRES_DB
  require_env AUTH_SECRET
  require_env AUTH_URL

  resolve_app_version
  echo "Wersja: ${APP_VERSION}"

  echo "[1/6] Zapis poprzedniego obrazu (rollback tag)"
  backup_current_image

  echo "[2/6] Budowanie obrazow"
  compose --profile tools build --pull

  echo "[3/6] Start PostgreSQL"
  compose up -d --wait db

  echo "[4/6] Migracje bazy"
  run_migrations

  echo "[5/6] Start aplikacji"
  compose up -d --wait web

  echo "[6/6] Cleanup nieuzywanych kontenerow"
  cleanup_unused_containers

  echo "Deploy zakonczony"
  echo "Projekt: ${PROJECT_NAME}"
  echo "Aplikacja na VPS: http://127.0.0.1:${WEB_BIND_PORT_VALUE}"
  echo "Wersja w stopce: ${APP_VERSION}"
  echo "Postgres zostaje w sieci ${PROJECT_NAME}_internal, bez portu na hoscie."
}

run_seed() {
  require_env ADMIN_EMAIL
  require_env ADMIN_PASSWORD

  echo "Start PostgreSQL"
  compose up -d --wait db

  run_migrations

  echo "Konta administratora i edytora"
  compose --profile tools run --rm migrate npx tsx src/db/seed.ts
  echo "Seed zakonczony"
}

run_rollback() {
  if ! docker image inspect "${WEB_ROLLBACK_IMAGE}" >/dev/null 2>&1; then
    echo "Brak rollback obrazu: ${WEB_ROLLBACK_IMAGE}"
    exit 1
  fi

  echo "[1/3] Odtwarzanie poprzedniego obrazu"
  docker image tag "${WEB_ROLLBACK_IMAGE}" "${WEB_IMAGE}"

  echo "[2/3] Restart aplikacji"
  compose up -d --wait web

  echo "[3/3] Cleanup nieuzywanych kontenerow"
  cleanup_unused_containers

  echo "Rollback zakonczony"
}

case "${ACTION}" in
  deploy)
    run_deploy
    ;;
  seed)
    run_seed
    ;;
  rollback)
    run_rollback
    ;;
esac
