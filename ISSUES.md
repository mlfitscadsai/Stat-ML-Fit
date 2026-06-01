# Project Issue Report — Stat-ML-Fit v2.0

**Branch:** `vjs3`
**Date:** 2026-03-04
**Reviewed by:** Code Review Audit

---

## Table of Contents

1. [Critical — Security](#1-critical--security)
2. [High — Functionality Bugs](#2-high--functionality-bugs)
3. [High — Error Handling](#3-high--error-handling)
4. [Medium — Code Quality](#4-medium--code-quality)
5. [Medium — Architecture & API Design](#5-medium--architecture--api-design)
6. [Low — Configuration & Deployment](#6-low--configuration--deployment)
7. [Low — Documentation](#7-low--documentation)
8. [Summary Table](#8-summary-table)

---

## 1. Critical — Security

### ISSUE-001: Hardcoded localhost API URLs

**Severity:** Critical
**Files:** All Vue components making HTTP requests (e.g., `upload-component.vue`, `sidebar-component.vue`)
**Description:**
Backend API URLs are hardcoded as `http://127.0.0.1:5000/...` throughout the frontend.
This breaks in any non-local environment (Docker, staging, production) and uses plain HTTP.

```javascript
// Current (broken in production)
axios.post('http://127.0.0.1:5000/upload', ...)
```

**Impact:** Application is non-functional in any deployed environment.
**Fix:** Use Vite environment variables (`import.meta.env.VITE_API_URL`) and move the base URL to `.env.local` / `.env.production`.

---

### ISSUE-002: Missing `constants.py` — HPC credentials undefined

**Severity:** Critical
**Files:** `backend/helpers/ssh_client.py`, `backend/helpers/commnad_write.py`
**Description:**
`constants.py` is listed in `.gitignore` and never committed. It is imported in `ssh_client.py` to supply `HPC_HOST`, `HPC_USER`, and `HPC_PASSWORD`. The application will crash at import time for any HPC-related feature without this file.

**Impact:** HPC integration is completely broken for any new developer or deployment.
**Fix:** Provide a documented `.env.example` and load credentials via environment variables (e.g., `os.environ.get('HPC_USER')`). Remove dependency on a file that cannot be in version control.

---

### ISSUE-003: SSH host key verification disabled

**Severity:** Critical
**File:** `backend/helpers/ssh_client.py`
**Description:**
```python
SSH_Client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
```
`AutoAddPolicy` silently accepts any host key, making all SSH connections vulnerable to man-in-the-middle attacks.

**Impact:** Attacker on the network can impersonate the HPC server and capture credentials or inject commands.
**Fix:** Use `paramiko.RejectPolicy()` and supply a known-hosts file, or embed the expected host key fingerprint.

---

### ISSUE-004: SSH password stored in source code / imported constant

**Severity:** Critical
**File:** `backend/helpers/ssh_client.py`
**Description:**
`HPC_PASSWORD` is imported from `constants.py` and passed directly to `connect()`. Even if `constants.py` is git-ignored today, the pattern encourages committing plaintext secrets.

**Impact:** Credential exposure if `constants.py` is accidentally committed.
**Fix:** Use key-based SSH authentication (`paramiko.RSAKey`) and store the key path in an environment variable.

---

### ISSUE-005: Unsafe query-parameter file access in `/run` endpoint

**Severity:** Critical
**File:** `backend/app.py`
**Description:**
```python
GET /run?file_name=...&target=...&seed=...&job_id=...
```
`file_name` and `target` are taken directly from query parameters with no sanitization. A crafted `file_name` value could traverse directories.

**Impact:** Path-traversal / arbitrary file read.
**Fix:** Validate `file_name` against a whitelist of uploaded file names. Use `werkzeug.utils.secure_filename` and confirm the resolved path stays inside `backend/files/`.

---

## 2. High — Functionality Bugs

### ISSUE-006: `CommandWriter.get_command` missing `self` parameter

**Severity:** High
**File:** `backend/helpers/commnad_write.py`
**Description:**
```python
class CommandWriter:
    def get_command(request, parameters):  # 'self' is missing
```
`request` receives the implicit `self` value. Calling `instance.get_command(req, params)` passes only one positional argument.

**Impact:** Runtime `TypeError` whenever HPC command generation is triggered.
**Fix:** Change signature to `def get_command(self, request, parameters):`.

---

### ISSUE-007: File type mismatch — UI accepts `.xlsx`/`.txt`, backend rejects them

**Severity:** High
**File:** `frontend/src/components/upload-component.vue`, `backend/app.py`
**Description:**
The upload UI exposes `.xlsx` and `.txt` as selectable file types, but the backend only processes `.csv` files using `pd.read_csv`. Non-CSV uploads silently fail or produce a confusing error.

**Impact:** User-facing data loss / confusion.
**Fix:** Either restrict the UI `accept` attribute to `.csv` only, or add proper `.xlsx` handling in the backend (`pd.read_excel`).

---

### ISSUE-008: No cleanup of uploaded files

**Severity:** High
**File:** `backend/app.py` (`/upload` endpoint)
**Description:**
Uploaded files are written to `backend/files/` and never deleted after processing.

**Impact:** Disk exhaustion over time; sensitive user data left on server.
**Fix:** Delete temporary uploads after the session ends or after a configurable TTL, using a background task or `atexit` hook.

---

### ISSUE-009: Duplicate generated Python files committed to repository

**Severity:** High
**File:** `backend/files/aa2df487cefff8.py`, `backend/files/b90be3d8878c08.py`
**Description:**
Two nearly identical auto-generated Python scripts were committed. These appear to be HPC job files that should never be in version control.

**Impact:** Repository pollution; potentially exposes user data or job configurations.
**Fix:** Add `backend/files/*.py` (and `backend/files/`) to `.gitignore` and remove existing files from history.

---

### ISSUE-010: Hardcoded `DATASET_SIZE = 10000` without documentation

**Severity:** High
**File:** `frontend/src/helpers/` (multiple files)
**Description:**
Datasets larger than 10 000 rows are randomly sampled down without notifying the user. The threshold is undocumented and cannot be configured.

**Impact:** Silent data reduction may produce misleading model results.
**Fix:** Show a warning in the UI when sampling occurs. Make the threshold configurable via settings.

---

## 3. High — Error Handling

### ISSUE-011: Backend catches only `FileNotFoundError`

**Severity:** High
**File:** `backend/app.py`
**Description:**
Most route handlers only catch `FileNotFoundError`. Any other exception (JSON parse error, pandas error, sklearn error) propagates as an unhandled 500 with a full Python traceback exposed to the client.

**Impact:** Internal implementation details leaked; poor UX.
**Fix:** Add broad `except Exception as e` handlers, log the full traceback server-side, and return a generic JSON error to the client.

---

### ISSUE-012: No input validation for JSON body fields

**Severity:** High
**File:** `backend/app.py`
**Description:**
```python
target_feature = content.get('target')   # Could be None
json_normalize(content.get('data'))      # Crashes if 'data' is missing
```
No checks confirm required fields exist before use.

**Impact:** Crashes with unhelpful errors; potential denial-of-service via malformed requests.
**Fix:** Validate all required fields with explicit checks or a schema library (e.g., `marshmallow`, `pydantic`).

---

### ISSUE-013: Frontend async operations lack error handling

**Severity:** High
**File:** Multiple Vue components
**Description:**
Several `await axios.post(...)` calls are not wrapped in `try/catch`. A network error or 500 response silently kills the async function, leaving the UI stuck in a loading state.

**Impact:** Users see a spinning loader with no feedback on failure.
**Fix:** Wrap all async calls in `try/catch` and display error messages via the notification system already present in the UI.

---

## 4. Medium — Code Quality

### ISSUE-014: `print()` used instead of `logging` in backend

**Severity:** Medium
**Files:** `backend/app.py`, `backend/helpers/ssh_client.py`, `backend/helpers/commnad_write.py`
**Description:**
```python
print(output)
print(errors)
print(filename)
```
`print` is used for all diagnostics. Output cannot be filtered by level, redirected to log files, or structured for log aggregators.

**Fix:** Replace with Python's `logging` module and set appropriate levels (`DEBUG`, `INFO`, `ERROR`).

---

### ISSUE-015: `console.log` debug statements left in frontend

**Severity:** Medium
**Files:** Multiple Vue components and helper files
**Description:**
```javascript
console.log(this.file);
console.log('SUCCESS!!');
console.log(new Set(encoded_y));
```
Debug logs expose internal state in browser consoles in production.

**Fix:** Remove all `console.log` calls. Add a Vite/ESLint rule (`no-console`) to prevent future regressions.

---

### ISSUE-016: Unused imports

**Severity:** Medium
**Files:** `backend/app.py`, `backend/helpers/commnad_write.py`
**Description:**

| File | Unused Import |
|------|--------------|
| `app.py` | `io` |
| `commnad_write.py` | `LabelEncoder` from sklearn |

**Fix:** Remove unused imports. Enable a linter (e.g., `flake8`, `ruff`) to prevent recurrence.

---

### ISSUE-017: Unused `@cross_origin` decorator

**Severity:** Medium
**File:** `backend/app.py`
**Description:**
```python
@cross_origin   # defined but never applied to any route
```
CORS is already handled globally by `CORS(app)`. The unused decorator import adds confusion and dead code.

**Fix:** Remove the `@cross_origin` import and the unused decorator.

---

### ISSUE-018: Typo in filename — `commnad_write.py`

**Severity:** Low–Medium
**File:** `backend/helpers/commnad_write.py`
**Description:**
The file is named `commnad_write.py` instead of `command_write.py`.

**Impact:** Confusing to contributors; misleading imports.
**Fix:** Rename to `command_write.py` and update all import references.

---

## 5. Medium — Architecture & API Design

### ISSUE-019: Mutations sent via `GET` request

**Severity:** Medium
**File:** `backend/app.py` (`/run` endpoint), frontend callers
**Description:**
The `/run` endpoint performs a side-effecting operation (launching an HPC job) but uses `GET` with query parameters. GET requests are cached by browsers and proxies and should be idempotent.

**Fix:** Change `/run` to `POST` with a JSON body.

---

### ISSUE-020: Inconsistent API response format

**Severity:** Medium
**File:** `backend/app.py`
**Description:**
Some endpoints return `(message, status_code)` tuples; others return plain dicts:
```python
return jsonify({'message': '...'}), 200   # endpoint A
return jsonify({'result': ...})            # endpoint B
```

**Impact:** Frontend must handle multiple shapes; increases likelihood of client-side bugs.
**Fix:** Standardize on a single response envelope, e.g. `{ "data": ..., "error": null }`.

---

### ISSUE-021: Flask app runs in development mode in Docker

**Severity:** Medium
**File:** `docker-compose.yaml`
**Description:**
```yaml
environment:
  - FLASK_ENV=development
```
`FLASK_ENV=development` enables the interactive debugger and auto-reloader, which expose internal stack traces to anyone who can reach the port.

**Fix:** Set `FLASK_ENV=production` in the compose file and override to `development` locally via a `.env` file not committed to git.

---

## 6. Low — Configuration & Deployment

### ISSUE-022: Dockerfile uses Node 14 (end-of-life)

**Severity:** Low
**File:** `Dockerfile`
**Description:**
Node 14 reached end-of-life in April 2023. It no longer receives security patches.

**Fix:** Upgrade the base image to `node:20-alpine` (LTS).

---

### ISSUE-023: No `.env.example` file

**Severity:** Low
**Files:** Repository root
**Description:**
There is no `.env.example` documenting which environment variables are required. New developers have no reference for what to configure.

**Fix:** Add `.env.example` listing all required variables with placeholder values:
```
VITE_API_URL=http://localhost:5000
HPC_HOST=
HPC_USER=
HPC_KEY_PATH=
```

---

### ISSUE-024: No automated tests

**Severity:** Low
**Files:** Entire project
**Description:**
No unit, integration, or end-to-end tests exist. The CI pipeline only builds the frontend; it does not validate correctness.

**Fix:** Add backend tests with `pytest` (at minimum for the Flask routes) and frontend component tests with Vitest.

---

### ISSUE-025: No linting or formatting checks in CI

**Severity:** Low
**File:** `.github/workflows/main.yml`
**Description:**
The CI workflow only runs `npm run build`. No ESLint, Prettier, Flake8, or type checks are run.

**Fix:** Add linting steps to the CI workflow for both frontend and backend.

---

## 7. Low — Documentation

### ISSUE-026: README is incomplete

**Severity:** Low
**File:** `README.md`
**Description:**
The README stops after the project structure section. Missing sections include:
- Setup / installation instructions
- Environment variable reference
- How to run locally
- How to run with Docker
- API endpoint documentation
- Contributing guidelines

**Fix:** Complete the README with all missing sections.

---

### ISSUE-027: No API documentation

**Severity:** Low
**File:** `backend/app.py`
**Description:**
The five Flask endpoints have no docstrings, no OpenAPI/Swagger spec, and no inline comments explaining expected inputs/outputs.

**Fix:** Add docstrings to each route and optionally generate docs with `flasgger` or `flask-smorest`.

---

## 8. Summary Table

| ID | Severity | Area | Title |
|----|----------|------|-------|
| ISSUE-001 | Critical | Security | Hardcoded localhost API URLs |
| ISSUE-002 | Critical | Security | Missing `constants.py` — HPC credentials undefined |
| ISSUE-003 | Critical | Security | SSH host key verification disabled |
| ISSUE-004 | Critical | Security | SSH password in source code |
| ISSUE-005 | Critical | Security | Unsafe query-parameter file access (path traversal) |
| ISSUE-006 | High | Bug | `get_command` missing `self` parameter |
| ISSUE-007 | High | Bug | File type mismatch — UI vs backend |
| ISSUE-008 | High | Bug | No cleanup of uploaded files |
| ISSUE-009 | High | Bug | Generated Python files committed to repo |
| ISSUE-010 | High | Bug | Silent dataset truncation at 10 000 rows |
| ISSUE-011 | High | Error Handling | Backend only catches `FileNotFoundError` |
| ISSUE-012 | High | Error Handling | No input validation on JSON request fields |
| ISSUE-013 | High | Error Handling | Frontend async calls lack try/catch |
| ISSUE-014 | Medium | Code Quality | `print()` used instead of `logging` |
| ISSUE-015 | Medium | Code Quality | `console.log` left in production code |
| ISSUE-016 | Medium | Code Quality | Unused imports |
| ISSUE-017 | Medium | Code Quality | Unused `@cross_origin` decorator |
| ISSUE-018 | Medium | Code Quality | Filename typo `commnad_write.py` |
| ISSUE-019 | Medium | Architecture | Side-effecting endpoint uses GET |
| ISSUE-020 | Medium | Architecture | Inconsistent API response format |
| ISSUE-021 | Medium | Deployment | Flask runs in development mode in Docker |
| ISSUE-022 | Low | Deployment | Node 14 is end-of-life in Dockerfile |
| ISSUE-023 | Low | Configuration | No `.env.example` file |
| ISSUE-024 | Low | Testing | No automated tests |
| ISSUE-025 | Low | CI/CD | No linting checks in CI |
| ISSUE-026 | Low | Documentation | README is incomplete |
| ISSUE-027 | Low | Documentation | No API documentation |

---

**Total issues found: 27**
- Critical: 5
- High: 8
- Medium: 7
- Low: 7
