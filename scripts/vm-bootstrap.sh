#!/usr/bin/env bash
# One-time fresh VM setup for Stat-ML-Fit (Debian).
# Run as gg1991 on a clean VM:
#   curl -fsSL https://raw.githubusercontent.com/mlfitscadsai/Stat-ML-Fit/main/scripts/vm-bootstrap.sh | bash
#   OR   bash scripts/vm-bootstrap.sh
#
# What it does:
#   1. Installs Docker, Node.js 22, git
#   2. Clones mlfitscadsai/Stat-ML-Fit → /opt/stat-ml-fit
#   3. Builds frontend, starts Docker API, configures nginx
#
# Optional env:
#   GITHUB_TOKEN=ghp_xxx     for private repo clone
#   GIT_BRANCH=main
#   APP_ROOT=/opt/stat-ml-fit
#   SKIP_CLONE=1             if repo already cloned

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/compose.sh
source "${SCRIPT_DIR}/lib/compose.sh"

APP_ROOT="${APP_ROOT:-/opt/stat-ml-fit}"
GIT_BRANCH="${GIT_BRANCH:-main}"
REPO="${REPO:-https://github.com/mlfitscadsai/Stat-ML-Fit.git}"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as gg1991, not root." >&2
  exit 1
fi

echo "==> Installing system packages (needs sudo)"
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx rsync

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker engine"
  sudo apt-get install -y docker.io
  sudo systemctl enable --now docker
  sudo usermod -aG docker "${USER}"
  echo "    Added ${USER} to docker group (log out/in if docker permission denied)"
fi

ensure_docker_compose

NODE_MAJOR="$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)"
if [[ "${NODE_MAJOR}" -lt 22 ]]; then
  echo "==> Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Node $(node -v)  npm $(npm -v)  docker $(docker --version 2>/dev/null || echo missing)"

sudo mkdir -p "${APP_ROOT}"
sudo chown "${USER}:${USER}" "${APP_ROOT}"

if [[ "${SKIP_CLONE:-0}" != "1" ]]; then
  CLONE_URL="${REPO}"
  if [[ -n "${GITHUB_TOKEN:-}" ]] && [[ "${CLONE_URL}" == https://github.com/* ]]; then
    CLONE_URL="https://${GITHUB_TOKEN}@github.com/${CLONE_URL#https://github.com/}"
  fi

  if [[ -d "${APP_ROOT}/.git" ]]; then
    echo "==> Repo exists at ${APP_ROOT}, updating from ${REPO}"
    git -C "${APP_ROOT}" remote set-url origin "${CLONE_URL}"
    git -C "${APP_ROOT}" fetch origin
    git -C "${APP_ROOT}" checkout "${GIT_BRANCH}" 2>/dev/null || \
      git -C "${APP_ROOT}" checkout -B "${GIT_BRANCH}" "origin/${GIT_BRANCH}"
    git -C "${APP_ROOT}" pull --ff-only origin "${GIT_BRANCH}"
  else
    echo "==> Cloning ${REPO} → ${APP_ROOT}"
    git clone --branch "${GIT_BRANCH}" --single-branch "${CLONE_URL}" "${APP_ROOT}"
  fi
fi

# Allow nginx config install without password after clone
SUDOERS="/etc/sudoers.d/stat-ml-fit-deploy"
if [[ ! -f "${SUDOERS}" ]]; then
  echo "==> Configuring sudoers for nginx deploy"
  echo "${USER} ALL=(ALL) NOPASSWD: ${APP_ROOT}/scripts/install-nginx-config.sh" | \
    sudo tee "${SUDOERS}" >/dev/null
  sudo chmod 440 "${SUDOERS}"
fi

cd "${APP_ROOT}"
chmod +x scripts/*.sh 2>/dev/null || true
bash scripts/vm-deploy.sh

echo ""
echo "============================================"
echo " Stat-ML-Fit is deployed"
echo " Site:  https://stat-ml-fit.scads.ai/"
echo " Path:  ${APP_ROOT}"
echo " API:   docker compose -f docker-compose.prod.yaml ps"
echo " Logs:  docker compose -f docker-compose.prod.yaml logs -f api"
echo "============================================"
