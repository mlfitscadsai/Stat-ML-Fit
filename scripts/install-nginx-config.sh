#!/usr/bin/env bash
# Install nginx site config on the VM.
# Run: sudo bash scripts/install-nginx-config.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${REPO_ROOT}/deploy/nginx/stat-ml-fit.scads.ai.conf"
SITE_NAME="stat-ml-fit.scads.ai"
TARGET="/etc/nginx/sites-available/${SITE_NAME}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

if [[ ! -f "${SOURCE}" ]]; then
  echo "Missing ${SOURCE}" >&2
  exit 1
fi

cp "${SOURCE}" "${TARGET}"
ln -sf "${TARGET}" "/etc/nginx/sites-enabled/${SITE_NAME}"

# Remove legacy site if present
rm -f /etc/nginx/sites-enabled/mlfit.com /etc/nginx/sites-available/mlfit.com

nginx -t
systemctl reload nginx
echo "Installed ${TARGET} and reloaded nginx."
