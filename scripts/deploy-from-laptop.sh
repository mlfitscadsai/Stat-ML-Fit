#!/usr/bin/env bash
# Deploy from your laptop via SSH (build locally, rsync dist, reload nginx, rebuild API).
# Usage (from repo root):
#   VITE_API_BASE=/api ./scripts/deploy-from-laptop.sh
#
# Requires SSH key access to gg1991@141.76.17.229

set -euo pipefail

SSH_TARGET="${SSH_TARGET:-gg1991@141.76.17.229}"
APP_ROOT="${APP_ROOT:-/opt/stat-ml-fit}"
VITE_API_BASE="${VITE_API_BASE:-/api}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building frontend locally"
cd "${REPO_ROOT}/frontend"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export CI=true DOCKER_BUILD=true VITE_API_BASE
npm ci
npm run build

echo "==> Syncing dist + config to VM"
rsync -avz --delete dist/ "${SSH_TARGET}:${APP_ROOT}/frontend/dist/"
rsync -avz deploy/nginx/stat-ml-fit.scads.ai.conf "${SSH_TARGET}:${APP_ROOT}/deploy/nginx/"
rsync -avz docker-compose.prod.yaml Dockerfile.api "${SSH_TARGET}:${APP_ROOT}/"

echo "==> Remote: nginx + docker"
ssh "${SSH_TARGET}" "cd '${APP_ROOT}' && sudo bash scripts/install-nginx-config.sh && docker compose -f docker-compose.prod.yaml up -d --build"

echo "==> Done → https://stat-ml-fit.scads.ai/"
