#!/usr/bin/env bash
# Shared Docker Compose helpers for Debian VMs (docker.io without compose plugin in apt).

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "docker compose is not installed (need plugin or docker-compose package)" >&2
    return 1
  fi
}

ensure_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    return 0
  fi

  echo "==> Installing Docker Compose"
  if apt-cache policy docker-compose-plugin 2>/dev/null | grep -q 'Candidate: [0-9]'; then
    sudo apt-get install -y docker-compose-plugin
    docker compose version >/dev/null 2>&1 && return 0
  fi

  if apt-cache policy docker-compose 2>/dev/null | grep -q 'Candidate: [0-9]'; then
    sudo apt-get install -y docker-compose
    command -v docker-compose >/dev/null 2>&1 && return 0
  fi

  echo "==> Installing Docker Compose plugin (GitHub release)"
  local version="${DOCKER_COMPOSE_VERSION:-v2.29.2}"
  local arch plugin_dir="/usr/local/lib/docker/cli-plugins"
  case "$(uname -m)" in
    x86_64) arch=linux-x86_64 ;;
    aarch64|arm64) arch=linux-aarch64 ;;
    *)
      echo "Unsupported CPU architecture for Docker Compose: $(uname -m)" >&2
      return 1
      ;;
  esac
  sudo mkdir -p "${plugin_dir}"
  sudo curl -fsSL \
    "https://github.com/docker/compose/releases/download/${version}/docker-compose-${arch}" \
    -o "${plugin_dir}/docker-compose"
  sudo chmod +x "${plugin_dir}/docker-compose"
  docker compose version >/dev/null 2>&1
}

# Wait until the host-mapped API health endpoint responds (after compose up).
wait_for_api_health() {
  local url="${1:-http://127.0.0.1:5001/health}"
  local max_attempts="${2:-60}"
  local i
  for ((i = 1; i <= max_attempts; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "    API ready (${i}/${max_attempts} checks)"
      return 0
    fi
    sleep 2
  done
  echo "    API not ready after $((max_attempts * 2))s — last logs:" >&2
  compose -f "${COMPOSE_FILE:-docker-compose.prod.yaml}" logs --tail=50 api >&2 || true
  return 1
}
