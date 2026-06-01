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
  echo "    Built $(du -sh dist | cut -f1)"
  cd ..
fi

if [[ "${SKIP_DOCKER:-0}" != "1" ]]; then
  echo "==> Starting API container"
  compose -f "${COMPOSE_FILE}" up -d --build
  compose -f "${COMPOSE_FILE}" ps
fi

if [[ "${SKIP_NGINX:-0}" != "1" ]]; then
  echo "==> Installing nginx config"
  sudo scripts/install-nginx-config.sh
fi

echo "==> Smoke checks"
test -f frontend/dist/index.html
curl -fsS -o /dev/null -w "API :5001 → HTTP %{http_code}\n" http://127.0.0.1:5001/ || \
  echo "WARN: API not reachable on :5001"
curl -fsS -o /dev/null -w "HTTPS site → HTTP %{http_code}\n" https://stat-ml-fit.scads.ai/ || \
  echo "WARN: HTTPS check failed"

echo "==> Deploy complete → https://stat-ml-fit.scads.ai/"
