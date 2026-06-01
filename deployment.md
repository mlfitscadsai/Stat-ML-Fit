# Deployment Guide: Current ML Fit Project to SSH VM

This guide updates the deployed ML Fit project on the Debian VM:

```bash
ssh gg1991@141.76.17.229
```

Do not store the VM password in this file, Git, GitHub Actions, or shell history. Prefer an SSH key when possible.

## Current VM Context

From the VM inspection:

- Existing app workspace: `/var/www/actions-runner/_work/mlfit/mlfit`
- Existing app/data path: `/var/www/aikit`
- Large disk usage is mostly:
  - `/var/www/actions-runner/_work/mlfit/mlfit/frontend`
  - old GitHub runner versions under `/var/www/actions-runner`
  - `/var/log` and `/var/cache`
- Current project has:
  - `Dockerfile`: builds Vue frontend, installs Flask backend, serves `frontend/dist` from Flask
  - `docker-compose.yaml`: exposes host `5001` to container `5000`
  - backend HPC credentials read from `HPC_HOST`, `HPC_USER`, `HPC_PASSWORD`

## 1. SSH Into The VM

```bash
ssh gg1991@141.76.17.229
```

After login, go to the deployed project:

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
pwd
```

Expected:

```text
/var/www/actions-runner/_work/mlfit/mlfit
```

## 2. Check The Current Running Deployment

Check whether Docker Compose is already running:

```bash
docker compose ps
```

If the VM has the older Compose binary:

```bash
docker-compose ps
```

Check which process is using the app port:

```bash
sudo ss -ltnp | grep ':5001' || true
```

Check disk before updating:

```bash
df -h
sudo du -sh /var/www/actions-runner/_work/mlfit/mlfit/frontend 2>/dev/null || true
sudo du -sh /var/log /var/cache /var/www/actions-runner/_work/mlfit 2>/dev/null
```

## 3. Backup The Current Deployment

Create a lightweight backup of deployment files before pulling updates:

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
mkdir -p /var/www/backups/mlfit
tar --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  --exclude='frontend/coverage' \
  --exclude='.git' \
  -czf "/var/www/backups/mlfit/mlfit-$(date +%Y%m%d-%H%M%S).tar.gz" .
ls -lh /var/www/backups/mlfit | tail
```

## 4. Clean Safe Generated Files

These folders are generated locally and can consume a lot of disk. Remove them before rebuilding:

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
rm -rf frontend/node_modules frontend/dist frontend/coverage
docker builder prune -f
docker image prune -f
```

Optional log/cache cleanup if disk is still tight:

```bash
sudo journalctl --vacuum-time=7d
sudo apt-get clean
```

Do not delete `/var/www/actions-runner/_work/mlfit/mlfit/backend/files` unless you intentionally want to remove uploaded datasets.

## 5. Pull The Current Project Updates

If the VM checkout tracks the Git repository:

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
git status --short
git pull --ff-only
```

If `git pull --ff-only` fails because the VM has local edits, inspect them first:

```bash
git status
git diff --stat
```

Do not run `git reset --hard` unless you are sure the VM has no valuable local-only changes.

## 6. Configure Environment Variables

The backend reads HPC settings from environment variables. Create or update a VM-only `.env` file:

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
nano .env
```

Example:

```dotenv
FLASK_ENV=production
HPC_HOST=your-hpc-host.example.edu
HPC_USER=your-hpc-user
HPC_PASSWORD=your-hpc-password
```

Keep `.env` out of Git. If `.env` is not ignored in the deployed checkout, do not commit it.

If using Docker Compose with `.env`, update `docker-compose.yaml` on the VM or in the repo so the service receives these variables:

```yaml
services:
  web:
    env_file:
      - .env
```

The current compose file already supports direct environment values for `HPC_HOST`, `HPC_USER`, and `HPC_PASSWORD`.

## 7. Build And Start The Updated App

From the project directory:

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
docker compose up -d --build
```

Fallback for older Docker Compose:

```bash
docker-compose up -d --build
```

The build compiles the frontend and packages the Flask app into the final image. The app should be available on VM port `5001`.

## 8. Verify The Deployment

Check container status:

```bash
docker compose ps
docker compose logs --tail=100 web
```

Fallback:

```bash
docker-compose ps
docker-compose logs --tail=100 web
```

Check the HTTP response locally on the VM:

```bash
curl -I http://127.0.0.1:5001/
curl http://127.0.0.1:5001/jobs/test-job-id
```

Expected:

- `/` returns an HTML response or `200 OK`
- `/jobs/test-job-id` returns JSON with a job status, or an HPC connection error only if the route tries to reach unavailable HPC settings

From your local machine, open:

```text
http://141.76.17.229:5001/
```

If the page does not load, check firewall/reverse proxy rules:

```bash
sudo ufw status
sudo ss -ltnp | grep ':5001'
```

## 9. Nginx: static SPA + `/api` → Flask

Production uses **same-origin HTTPS**: the Vue app calls `/api/...`, and nginx proxies to Flask on `127.0.0.1:5001`.

Canonical config in the repo:

```text
deploy/nginx/stat-ml-fit.scads.ai.conf
```

Install on the VM (from the project checkout):

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
sudo bash scripts/install-nginx-config.sh
```

Or copy manually:

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

Keep Flask listening on **5001** (Docker `5001:5000` or `flask run --port=5001`). The frontend build sets `VITE_API_BASE=/api` in CI (see `deploy.yml`).

## 10. Rollback

If the new deployment fails:

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
docker compose logs --tail=200 web
docker compose down
```

Restore the most recent backup to a temporary folder:

```bash
mkdir -p /var/www/restore/mlfit
tar -xzf /var/www/backups/mlfit/<backup-file>.tar.gz -C /var/www/restore/mlfit
```

Then either fix the current checkout and rebuild, or replace the checkout from the backup after confirming what changed.

## 11. Routine Maintenance

Use these periodically to keep the VM healthy:

```bash
df -h
docker system df
docker image prune -f
docker builder prune -f
sudo journalctl --vacuum-time=14d
sudo apt-get clean
```

Avoid deleting the GitHub Actions runner `_work` directory while a runner job is active.

## 12. GitHub Actions CI/CD (nginx, no Docker)

Workflow: `.github/workflows/deploy.yml`

Nginx on the VM serves static files from:

```text
/var/www/actions-runner/_work/mlfit/mlfit/frontend/dist
```

### Option A — Self-hosted runner (recommended)

This matches your current layout (`actions-runner/_work/mlfit/mlfit`).

On the VM (`gg1991@141.76.17.229`):

```bash
# One-time: install GitHub Actions runner (if not already present)
mkdir -p ~/actions-runner && cd ~/actions-runner
# Download the runner package from your GitHub repo: Settings → Actions → Runners → New self-hosted runner
./config.sh --url https://github.com/<ORG>/<REPO> --token <RUNNER_TOKEN>
sudo ./svc.sh install
sudo ./svc.sh start
```

Ensure the runner user can reload nginx without a password prompt, or skip reload and reload manually:

```bash
sudo visudo
# gg1991 ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx
```

**Automatic deploy:** push to `main` or `master` → workflow runs tests, `npm run build` on the runner, output lands in `frontend/dist` (same path nginx uses).

**Manual deploy from GitHub:** Actions → “Deploy to ML Fit VM” → Run workflow.

### Option B — SSH deploy from GitHub cloud runners

Use this if you do not use a self-hosted runner. Add repository secrets:

| Secret | Example |
|--------|---------|
| `SSH_HOST` | `141.76.17.229` |
| `SSH_USER` | `gg1991` |
| `SSH_PRIVATE_KEY` | Private key (PEM), no passphrase preferred |

Optional:

| Secret / Variable | Purpose |
|-------------------|---------|
| `VITE_API_BASE` | API base for production build (default `/api` — same-origin via nginx) |
| Variable `FORCE_SSH_DEPLOY` | Set to `true` to always use SSH deploy |

Run workflow with input **deploy_via_ssh** = `true`.

### Option C — Manual deploy from your laptop

```bash
chmod +x scripts/deploy-vm.sh
VITE_API_BASE=/api ./scripts/deploy-vm.sh
```

Requires SSH key login to `gg1991@141.76.17.229` and write access to `frontend/dist` on the VM.

### Backend (Flask on port 5001)

The deploy workflow updates the **frontend** and can install `deploy/nginx/stat-ml-fit.scads.ai.conf`. The SPA calls `/api/...` (proxied to Flask on port 5001).

Keep Flask running separately on the VM (Docker or systemd), for example:

```bash
cd /var/www/actions-runner/_work/mlfit/mlfit
docker compose up -d --build
# or: flask run --host=0.0.0.0 --port=5001
```

Verify after deploy:

```bash
curl -I https://stat-ml-fit.scads.ai/
curl -I http://127.0.0.1:5001/
```

## 13. Deployment Checklist

- [ ] SSH into `gg1991@141.76.17.229`
- [ ] Confirm project path: `/var/www/actions-runner/_work/mlfit/mlfit`
- [ ] Self-hosted runner online (Option A) or SSH secrets set (Option B)
- [ ] Push to `main` / `master` or run “Deploy to ML Fit VM” workflow
- [ ] Confirm `frontend/dist/index.html` exists on VM
- [ ] `sudo nginx -t && sudo systemctl reload nginx`
- [ ] Confirm `.env` / Flask backend if using HPC features
- [ ] Verify `https://stat-ml-fit.scads.ai/`
- [ ] Verify API: `http://141.76.17.229:5001/` (or your `VITE_API_BASE`)
