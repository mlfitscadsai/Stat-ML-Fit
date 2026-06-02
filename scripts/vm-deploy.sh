#!/usr/bin/env bash
# Deploy / update Stat-ML-Fit on the VM (run after bootstrap).
# Usage:
#   cd /opt/stat-ml-fit && bash scripts/vm-deploy.sh
#
# Optional env:
#   GIT_BRANCH=main
#   SKIP_GIT=1
#   SKIP_DOCKER=1
#   SKIP_NGINX=1
#   SKIP_FRONTEND=1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/compose.sh
source "${SCRIPT_DIR}/lib/compose.sh"

APP_ROOT="${APP_ROOT:-/opt/stat-ml-fit}"
GIT_BRANCH="${GIT_BRANCH:-main}"
VITE_API_BASE="${VITE_API_BASE:-/api}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yaml}"

cd "${APP_ROOT}"
echo "==> App root: $(pwd)"

if [[ "${SKIP_GIT:-0}" != "1" ]] && [[ -d .git ]]; then
  echo "==> Pulling ${GIT_BRANCH}"
  git fetch origin
  git checkout "${GIT_BRANCH}"
  git pull --ff-only origin "${GIT_BRANCH}"
  git log -1 --oneline
fi

if [[ ! -f .env ]]; then
  echo "==> Creating .env from deploy/env.example"
  cp deploy/env.example .env
  echo "    Edit ${APP_ROOT}/.env for HPC credentials if needed."
fi

if [[ "${SKIP_FRONTEND:-0}" != "1" ]]; then
  echo "==> Building frontend (VITE_API_BASE=${VITE_API_BASE})"
  rm -rf frontend/node_modules frontend/dist frontend/coverage
  cd frontend
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
  export CI=true DOCKER_BUILD=true VITE_API_BASE
  npm ci
  npm run build
  test -f dist/index.html
  if grep -rq 'danfojs/dist/danfojs-browser' dist/assets/*.js 2>/dev/null; then
    echo "ERROR: frontend dist still contains bare danfojs import (rebuild failed)." >&2
    exit 1
  fi
  if grep -rqE 'from["'\'']?\./data-danfo-' dist/assets/*.js 2>/dev/null; then
    echo "ERROR: danfo must not be Vite-bundled (causes white screen). Use public/vendor/danfo.bundle.js." >&2
    exit 1
  fi
  test -f dist/vendor/danfo.bundle.js || {
    echo "ERROR: missing dist/vendor/danfo.bundle.js (run prebuild copy-danfo-bundle)" >&2
    exit 1
  fi
  test -f dist/webr/dist/webr.mjs || test -f public/webr/dist/webr.mjs || {
    echo "WARN: webr.mjs missing — in-browser R may be disabled until prebuild copies webr assets"
  }
  echo "    Built $(du -sh dist | cut -f1)"
  cd ..
fi

if [[ "${SKIP_DOCKER:-0}" != "1" ]]; then
  echo "==> Starting API container"
  if compose -f "${COMPOSE_FILE}" up -d --build --wait 2>/dev/null; then
    :
  else
    compose -f "${COMPOSE_FILE}" up -d --build
    wait_for_api_health || echo "WARN: API health check timed out (see logs above)"
  fi
  compose -f "${COMPOSE_FILE}" ps
fi

if [[ "${SKIP_NGINX:-0}" != "1" ]]; then
  echo "==> Installing nginx config"
  sudo scripts/install-nginx-config.sh
fi

echo "==> Smoke checks"
test -f frontend/dist/index.html
if curl -fsS http://127.0.0.1:5001/health | python3 -m json.tool >/dev/null 2>&1; then
  echo "API health → OK"
else
  echo "WARN: API not reachable on :5001/health (try: docker compose -f ${COMPOSE_FILE} logs --tail=80 api)"
fi
curl -fsS -o /dev/null -w "HTTPS SPA  → HTTP %{http_code}\n" https://stat-ml-fit.scads.ai/ || \
  echo "WARN: HTTPS SPA check failed"
curl -fsS -o /dev/null -w "HTTPS /api/health → HTTP %{http_code}\n" https://stat-ml-fit.scads.ai/api/health 2>/dev/null || \
  echo "WARN: HTTPS API proxy check failed"

echo "==> Deploy complete → https://stat-ml-fit.scads.ai/"
