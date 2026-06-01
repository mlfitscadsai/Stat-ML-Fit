# Stat-ML-Fit deployment guide

Deploy the [mlfitscadsai/Stat-ML-Fit](https://github.com/mlfitscadsai/Stat-ML-Fit) application to the SCADS Debian VM.

| Item | Value |
|------|--------|
| **Site** | https://stat-ml-fit.scads.ai/ |
| **VM** | `ssh gg1991@141.76.17.229` |
| **App root** | `/opt/stat-ml-fit` |
| **Nginx static root** | `/opt/stat-ml-fit/frontend/dist` |
| **Flask API (Docker)** | `127.0.0.1:5001` → container port `5000` |
| **Default branch** | `main` |

Do not store VM passwords, tokens, or HPC credentials in Git, GitHub Actions logs, or this file. Use SSH keys and a VM-local `.env` file.

---

## Architecture

```text
Browser → HTTPS (nginx) → /opt/stat-ml-fit/frontend/dist  (Vue SPA)
                       → /api/* proxied to 127.0.0.1:5001 (Flask in Docker)
```

- **Frontend:** built with `VITE_API_BASE=/api` so API calls are same-origin via nginx.
- **Backend:** Flask app in Docker; `docker-compose.yaml` maps host `5001:5000`.
- **Nginx config:** `deploy/nginx/stat-ml-fit.scads.ai.conf` (install with `scripts/install-nginx-config.sh`).

---

## Prerequisites

- SSH access as `gg1991` (key-based login recommended).
- DNS / TLS for `stat-ml-fit.scads.ai` (Let’s Encrypt paths in the nginx config).
- GitHub repo access to clone `https://github.com/mlfitscadsai/Stat-ML-Fit.git`.

**Never commit:** `node_modules/`, `frontend/dist/`, `.env`, or virtualenvs (see `.gitignore`).

---

## First-time VM setup (recommended)

Run on the VM as `gg1991` (not root):

```bash
curl -fsSL https://raw.githubusercontent.com/mlfitscadsai/Stat-ML-Fit/main/scripts/vm-bootstrap.sh | bash
```

Or from a local checkout copied to the VM:

```bash
bash /path/to/Stat-ML-Fit/scripts/vm-bootstrap.sh
```

`vm-bootstrap.sh` will:

1. Install system packages, Docker (`docker.io`), Docker Compose (apt package, `docker-compose`, or binary fallback).
2. Install Node.js 22 if needed.
3. Clone or update the repo at `/opt/stat-ml-fit` from `mlfitscadsai/Stat-ML-Fit` on branch `main`.
4. Run `scripts/vm-deploy.sh` (build frontend, start API, install nginx).

**Optional environment variables:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_ROOT` | `/opt/stat-ml-fit` | Install directory |
| `GIT_BRANCH` | `main` | Branch to clone/pull |
| `REPO` | `https://github.com/mlfitscadsai/Stat-ML-Fit.git` | Git remote |
| `GITHUB_TOKEN` | (unset) | For private clone over HTTPS |
| `SKIP_CLONE` | `0` | Set to `1` if repo already present |

After Docker install, log out and back in (or `newgrp docker`) if `docker` permission is denied.

---

## Routine updates on the VM

```bash
cd /opt/stat-ml-fit
bash scripts/vm-deploy.sh
```

`vm-deploy.sh` pulls `main`, builds the frontend, starts Docker, and reloads nginx.

**Skip steps when needed:**

| Variable | Effect |
|----------|--------|
| `SKIP_GIT=1` | Do not `git pull` |
| `SKIP_FRONTEND=1` | Skip `npm ci` / `npm run build` |
| `SKIP_DOCKER=1` | Skip Docker rebuild |
| `SKIP_NGINX=1` | Skip nginx config install |

**Compose file:** scripts default to `docker-compose.prod.yaml`. The repo currently ships `docker-compose.yaml` for the API. Until a prod compose file is added, run:

```bash
COMPOSE_FILE=docker-compose.yaml bash scripts/vm-deploy.sh
```

---

## Deploy from your laptop

Build locally, rsync `frontend/dist`, refresh nginx and API on the VM:

```bash
# From repo root
VITE_API_BASE=/api ./scripts/deploy-from-laptop.sh
```

Defaults: `SSH_TARGET=gg1991@141.76.17.229`, `APP_ROOT=/opt/stat-ml-fit`.

Requires SSH key login. Ensure `docker-compose.prod.yaml` exists on the VM or adjust the script to use `docker-compose.yaml`.

---

## Environment variables (HPC)

On the VM:

```bash
cp /opt/stat-ml-fit/deploy/env.example /opt/stat-ml-fit/.env
nano /opt/stat-ml-fit/.env
```

Example:

```dotenv
FLASK_ENV=production
HPC_HOST=your-hpc-host.example.edu
HPC_USER=your-hpc-user
HPC_PASSWORD=your-hpc-password
```

Keep `.env` only on the server. Wire it into Docker via `env_file` in your compose file when you add production compose settings.

---

## Nginx

Install or refresh site config from the repo:

```bash
cd /opt/stat-ml-fit
sudo bash scripts/install-nginx-config.sh
```

Manual equivalent:

```bash
sudo cp deploy/nginx/stat-ml-fit.scads.ai.conf /etc/nginx/sites-available/stat-ml-fit.scads.ai
sudo ln -sf /etc/nginx/sites-available/stat-ml-fit.scads.ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Verify:

```bash
curl -I https://stat-ml-fit.scads.ai/
curl -s https://stat-ml-fit.scads.ai/api/jobs/test-job-id | head
curl -s http://127.0.0.1:5001/jobs/test-job-id | head
```

---

## Docker (API only)

From `/opt/stat-ml-fit`:

```bash
docker compose -f docker-compose.yaml up -d --build
docker compose -f docker-compose.yaml ps
docker compose -f docker-compose.yaml logs --tail=100 web
```

Check port and health:

```bash
sudo ss -ltnp | grep ':5001' || true
curl -I http://127.0.0.1:5001/
```

On Debian, if `docker compose` is missing, bootstrap installs a Compose plugin; legacy `docker-compose` also works via `scripts/lib/compose.sh`.

---

## GitHub Actions

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

Triggers on push to `main` or `master` (after tests pass).

### Option A — Self-hosted runner (typical)

Runner builds on the VM; output is synced to `DEPLOY_DIST` (default `/opt/stat-ml-fit/frontend/dist`).

Repository variables (optional):

| Variable | Default |
|----------|---------|
| `SSH_HOST` | `141.76.17.229` |
| `SSH_USER` | `gg1991` |
| `DEPLOY_ROOT` | `/opt/stat-ml-fit` |
| `DEPLOY_DIST` | `/opt/stat-ml-fit/frontend/dist` |

Register the runner against:

```text
https://github.com/mlfitscadsai/Stat-ML-Fit
```

(Settings → Actions → Runners → New self-hosted runner)

### Option B — SSH deploy from GitHub cloud

Repository secrets:

| Secret | Purpose |
|--------|---------|
| `SSH_PRIVATE_KEY` | PEM key for `gg1991@141.76.17.229` |
| `SSH_HOST` | Optional override |
| `SSH_USER` | Optional override |

Run workflow **Deploy to ML Fit VM** with **deploy_via_ssh** = `true`.

Set variable `FORCE_SSH_DEPLOY=true` to always use SSH deploy on push.

### Workflow inputs (manual run)

| Input | Purpose |
|-------|---------|
| `deploy_via_ssh` | Build on GitHub, rsync to VM |
| `update_nginx` | Install nginx site config |
| `update_backend` | `docker compose up` in `DEPLOY_ROOT` (needs `docker-compose.prod.yaml`) |

---

## Migrating from the old layout

If the VM still uses the legacy GitHub Actions path:

```text
/var/www/actions-runner/_work/mlfit/mlfit
```

or the old repo `PurebyteAI/Stat-ML-Fit-v2.0` / branch `vjs3`:

1. Run `vm-bootstrap.sh` to install under `/opt/stat-ml-fit`, **or**
2. Manually repoint git:

```bash
cd /opt/stat-ml-fit   # or your existing checkout
git remote set-url origin https://github.com/mlfitscadsai/Stat-ML-Fit.git
git fetch origin
git checkout main
git pull --ff-only origin main
COMPOSE_FILE=docker-compose.yaml bash scripts/vm-deploy.sh
```

Update the self-hosted runner registration to `mlfitscadsai/Stat-ML-Fit` and set `DEPLOY_ROOT` / `DEPLOY_DIST` to `/opt/stat-ml-fit` paths.

---

## Backup and rollback

Lightweight backup before major changes:

```bash
cd /opt/stat-ml-fit
mkdir -p /var/www/backups/stat-ml-fit
tar --exclude='frontend/node_modules' \
    --exclude='frontend/dist' \
    --exclude='frontend/coverage' \
    --exclude='.git' \
    -czf "/var/www/backups/stat-ml-fit/stat-ml-fit-$(date +%Y%m%d-%H%M%S).tar.gz" .
```

Rollback: extract backup to a temp directory, compare, restore files or redeploy from a known good `main` commit:

```bash
cd /opt/stat-ml-fit
git fetch origin
git checkout main
git reset --hard origin/main   # only if you accept losing local VM edits
COMPOSE_FILE=docker-compose.yaml bash scripts/vm-deploy.sh
```

---

## Maintenance

```bash
df -h
docker system df
docker image prune -f
docker builder prune -f
sudo journalctl --vacuum-time=14d
sudo apt-get clean
```

Before deleting large trees under `/opt/stat-ml-fit`, do not remove `backend/files` unless you intend to drop uploaded datasets.

Free disk before rebuilds:

```bash
cd /opt/stat-ml-fit
rm -rf frontend/node_modules frontend/dist frontend/coverage
```

---

## Deployment checklist

- [ ] SSH: `gg1991@141.76.17.229`
- [ ] App at `/opt/stat-ml-fit`, remote `mlfitscadsai/Stat-ML-Fit`, branch `main`
- [ ] `frontend/dist/index.html` present after build
- [ ] Flask reachable on `127.0.0.1:5001`
- [ ] Nginx: `sudo nginx -t && sudo systemctl reload nginx`
- [ ] `.env` configured if using HPC features
- [ ] https://stat-ml-fit.scads.ai/ loads
- [ ] API: `curl https://stat-ml-fit.scads.ai/api/...` or `curl http://127.0.0.1:5001/...`

---

## Scripts reference

| Script | Use |
|--------|-----|
| `scripts/vm-bootstrap.sh` | One-time VM setup + first deploy |
| `scripts/vm-deploy.sh` | Pull, build, Docker, nginx on VM |
| `scripts/deploy-from-laptop.sh` | Local build + rsync + remote reload |
| `scripts/install-nginx-config.sh` | Install nginx site (sudo) |
| `scripts/lib/compose.sh` | `compose` helper + `ensure_docker_compose` |

Shell scripts use LF line endings (see `.gitattributes`).
