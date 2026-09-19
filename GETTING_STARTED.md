# Developer Getting Started & Operations Guide

Welcome to the **RC Car & Rock Crawler Garage & Setup Logger** engineering workspace! This guide provides comprehensive, step-by-step instructions for getting your development environment operational, understanding the system architecture, testing workflows, and resolving common operational issues.

---

## 1. Prerequisites & System Requirements

Ensure the following tools are installed on your host system:

| Dependency | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.17.0 LTS` | TypeScript compilation, backend runtime, frontend tooling |
| **npm** | `>= 10.0.0` | Package management and script execution |
| **Docker Engine** | `>= 24.0.0` | Container orchestration and hermetic deployment |
| **Docker Compose** | `>= 2.20.0` (v2 plugin) | Multi-container composition and network isolation |
| **PostgreSQL** *(optional)* | `16.x` | Required only when running bare-metal without Docker |

---

## 2. Fast Launch with Docker Compose (Recommended)

Docker Compose provisions the complete multi-tier topology (`rc-db`, `rc-backend`, `rc-frontend`) within a dedicated bridge network (`rc-isolated-net`) bounded to a strict **640MB combined RAM allocation**.

### Step 1: Clone and Configure Environment
```bash
# Navigate to workspace root
cd /workspace

# Copy the environment template
cp .env.example .env
```

Review the `.env` settings:
```ini
POSTGRES_DB=rc_garage_prod
POSTGRES_USER=rc_garage_admin
POSTGRES_PASSWORD=change-me-in-production
JWT_SECRET=change-me-to-a-long-random-secret
JWT_EXPIRATION=7d
APP_BASE_URL=http://127.0.0.1:3742
# Optional: designate an initial admin user
BOOTSTRAP_ADMIN_EMAIL=admin@rc-garage.community
# Google reCAPTCHA v2 checkbox (dev-bypass skips siteverify locally)
RECAPTCHA_SECRET_KEY=dev-bypass
VITE_RECAPTCHA_SITE_KEY=dev-bypass
```

### Step 2: Build and Boot Containers
```bash
docker compose up -d --build
```

### Step 3: Verify Container Health
Check the container status and resource bounds:
```bash
docker compose ps
```

Expected healthy output:
```text
NAME          IMAGE              COMMAND                  SERVICE       CREATED         STATUS                   PORTS
rc-backend    rc-backend:prod    "node --max-old-spac…"   rc-backend    1 minute ago    Up (healthy)             127.0.0.1:5742->5742/tcp
rc-db         postgres:16-alpine "docker-entrypoint.s…"   rc-db         1 minute ago    Up (healthy)             
rc-frontend   rc-frontend:prod   "/docker-entrypoint.…"   rc-frontend   1 minute ago    Up                       127.0.0.1:3742->3742/tcp
```

### Step 4: Access Application Endpoints
- **Pit-Mat Web Workbench:** [http://127.0.0.1:3742](http://127.0.0.1:3742)
- **API Health Check:** [http://127.0.0.1:5742/api/garage/health](http://127.0.0.1:5742/api/garage/health)
- **API Base Route:** [http://127.0.0.1:5742/api/garage](http://127.0.0.1:5742/api/garage)

### Step 5: Stop Containers
```bash
docker compose down
```
*(To preserve database volume data, omit `-v`. To completely purge database data, pass `-v`.)*

---

## 3. Local Bare-Metal Development (Without Docker)

When developing features with live Hot Module Replacement (HMR) and backend debuggers, run the components directly on your host machine.

### Step 1: Start PostgreSQL
Ensure PostgreSQL 16 is running on `127.0.0.1:5432` with a database named `rc_garage_prod` and appropriate credentials.

### Step 2: Configure Backend Environment
Create `backend/.env`:
```ini
PORT=5742
DATABASE_URL=postgresql://rc_garage_admin:password@127.0.0.1:5432/rc_garage_prod?schema=public
JWT_SECRET=dev-secret-key-32-chars-minimum-length
JWT_EXPIRATION=7d
APP_BASE_URL=http://127.0.0.1:3742
BOOTSTRAP_ADMIN_EMAIL=
```

### Step 3: Install Backend Dependencies & Run Migrations
```bash
cd backend
npm install
npm run migration:up
```

Start the backend in watch mode:
```bash
npm run start:dev
```
The NestJS server will start on [http://127.0.0.1:5742](http://127.0.0.1:5742).

### Step 4: Install Frontend Dependencies & Start Vite Dev Server
Open a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
The Vite development server will start on [http://127.0.0.1:3742](http://127.0.0.1:3742) with proxying enabled to the backend API at `http://127.0.0.1:5742`.

---

## 4. End-to-End Walkthrough Scenarios

Test the core features of the platform step-by-step:

### Scenario A: Driver Onboarding & Garage Fleet Registration
1. Open [http://127.0.0.1:3742](http://127.0.0.1:3742) in your browser.
2. Click **"Sign In"** in the top diagnostic bar, select **"Register"**, and create an account:
   - Callsign: `TrailBoss`
   - Email: `trailboss@rc-garage.community`
   - Password: `Password123!`
3. Navigate to **"Fleet Garage"** in the left toolbox drawer.
4. Click **"Add Chassis"** and create your first vehicle:
   - Make: `Element RC`
   - Model: `Enduro Sendero HD`
   - Scale: `1/10`
   - Class: `Scale Rock Crawler`
5. Observe the newly created Chassis Bay Card with telemetry tags and active status.

### Scenario B: Setup Sheet Logging & Calculations
1. Open the newly registered chassis and click **"Open Setup Clipboard"**.
2. **Drivetrain & Gearing:**
   - Set Pinion to `14T` and Spur to `56T`.
   - Set Transmission Internal Ratio to `2.60`.
   - Observe the live calculated **Final Drive Ratio (FDR)**: $(56 / 14) \times 2.60 = 10.40$.
3. **Corner Weight & Balance:**
   - Input corner scale weights: Front-Left: `800g`, Front-Right: `700g`, Rear-Left: `500g`, Rear-Right: `500g`.
   - Observe the live **Center of Gravity (CoG) Front Bias**: $(1500 / 2500) \times 100 = 60.0\%$.
4. **Suspension & Tires:**
   - Set Front Shock Viscosity to `30 WT` (normalized to `350 CST`).
   - Select Surface: `Granite Rock`.
5. Toggle **"Make Public"** and click **"Save Setup Sheet"**.

### Scenario C: Community Feed, Lineage Forking & Diff Engine
1. In an incognito tab, register a second driver: `@RockHound` (`rockhound@rc-garage.community`).
2. Add a chassis: `Axial SCX10 III` (`1/10`, `Scale Rock Crawler`).
3. Navigate to the **"Community Feed"** workbench.
4. Locate the setup logged by `@TrailBoss` and click **"Fork to My Garage"**.
5. Select `@RockHound`'s `Axial SCX10 III` as the target chassis.
6. Open the forked setup on the Setup Clipboard, modify the Pinion to `12T`, and save.
7. Click **"Inspect Fork Diff"**:
   - Verify the parent setup displays `14T Pinion`.
   - Verify the child setup displays `12T Pinion`.
   - Verify the delta chip displays `-2T Pinion` highlighted in nitromethane yellow.

### Scenario D: Physical QR Chassis Sticker Printing
1. On any saved setup, click **"Print Chassis Sticker"**.
2. The modal loads an interactive 1:1 preview of the 1.5" x 1.5" vinyl decal featuring:
   - Level 'H' Error Correction QR Code.
   - Vehicle Make, Model, and Setup Title.
   - Calculated FDR and short URL (`/s/:slug`).
3. Select:
   - **Download SVG:** For vinyl plotters and laser cutters.
   - **Download PNG:** 300 DPI high-contrast raster for waterproof sticker paper.
   - **Direct Print:** Clean print layout omitting UI controls.
4. Open the `/s/:slug` URL directly to verify the mobile pit inspection view.

### Scenario E: Scrutineering Desk (Admin Moderation)
1. If your user email matches `BOOTSTRAP_ADMIN_EMAIL`, your account is promoted to `admin` on login.
2. Elevated roles (`moderator` and `admin`) see the **"Scrutineering Desk"** tab in the toolbox drawer.
3. Features available:
   - **Overview:** Active KPIs (total drivers, setups, hidden items, suspensions).
   - **Drivers:** Search drivers, suspend abusive accounts with required reason, change staff roles.
   - **Setups:** Inspect public and private setups, force-hide abusive configurations, permanently delete setups (preserving fork lineage via `ON DELETE SET NULL`).
   - **Audit Trail:** Immutable log of all administrative actions with actor, target, and timestamp.

---

## 5. Verification & Testing Playbook

Execute test suites from the project root using Windows semicolon delimiters:

### Backend Unit Tests
Validates mathematical calculations, diff algorithms, and QR URL utilities:
```bash
npm run test:unit
```

### Full Backend Integration Suite
Executes database migrations, authentication guards, vehicle fleet endpoints, setup telemetry, fork lineage, QR engine, and community feed:
```bash
npm run test:e2e
```

### End-to-End Multi-Driver Garage Workflow
Executes the comprehensive automated workflow testing drivers, vehicles, setups, forking, diff calculation, QR resolving, and container resource limits:
```bash
npm run test:workflow
```

### Frontend Component & Store Tests
Executes Vitest tests for Zustand stores, modals, and workbench views:
```bash
npm run test:frontend
```

---

## 6. Operational Troubleshooting Runbook

### Issue: Port Collision on Host
**Symptom:** Docker or dev servers fail with `bind: address already in use` on `3742` or `5742`.
**Remedy:**
1. Check what is running on the port:
   ```bash
   lsof -i :3742 ; lsof -i :5742
   ```
2. If another instance of the container or Vite dev server is running, terminate it or stop Docker Compose:
   ```bash
   docker compose down
   ```

### Issue: Database Connection Refused
**Symptom:** Backend logs show `ECONNREFUSED 127.0.0.1:5432` or `rc-db:5432`.
**Remedy:**
1. In Docker, ensure `rc-db` passes its healthcheck before backend starts:
   ```bash
   docker compose ps rc-db
   docker compose logs rc-db
   ```
2. In bare-metal development, verify PostgreSQL is running:
   ```bash
   pg_isready -h 127.0.0.1 -p 5432
   ```

### Issue: Container Memory Exceeded (OOMKilled)
**Symptom:** `rc-backend` exits unexpectedly with code `137`.
**Explanation:** The production backend container has a strict 256MB RAM cap.
**Remedy:**
1. Check `docker stats`.
2. Ensure Node.js V8 heap limit is configured:
   ```dockerfile
   CMD ["node", "--max-old-space-size=192", "dist/main.js"]
   ```

### Issue: Database Migration Rollback
**Symptom:** Schema modification fails midway or requires reset.
**Remedy:**
```bash
cd backend
# Revert the latest migration
npm run migration:down

# Reapply up migrations
npm run migration:up
```

---

## 7. Public Host (TLS, backups, recaptcha, CI)

Compose still binds **only** `127.0.0.1:3742` and `127.0.0.1:5742`. Do not publish those ports on `0.0.0.0`. Terminate TLS on the host and reverse-proxy to loopback.

### 7.1 Host nginx + Let's Encrypt
1. Install `/docker/host-nginx.conf.example` as the site config (`api_limit` 15r/s and `auth_limit` 3r/s stay required at the public edge).
2. Point `server_name` at your hostname and follow the Certbot comments in that file.
3. Nest CORS stays **off** for this same-origin topology. Split-origin deploys must set CORS later.

### 7.2 PostgreSQL backup and restore
Dump from the running `rc-db` container (creates gitignored `backups/`):

```bash
# Linux / macOS
bash scripts/backup-pg.sh

# Windows
powershell -File scripts/backup-pg.ps1
```

The script writes `backups/rc-garage-YYYYMMDD.sql` via `docker compose exec -T rc-db pg_dump`. Restore example:

```bash
docker compose exec -T rc-db psql -U "$POSTGRES_USER" "$POSTGRES_DB" < backups/rc-garage-YYYYMMDD.sql
```

### 7.3 Google reCAPTCHA v2
Create a **Checkbox** key pair at [Google reCAPTCHA admin](https://www.google.com/recaptcha/admin). Allowlist `localhost` plus the public hostname. Set `RECAPTCHA_SECRET_KEY` for `rc-backend` and `VITE_RECAPTCHA_SITE_KEY` as a **frontend image build ARG** (Vite inlines `VITE_*` at compile time).

Local and e2e use `RECAPTCHA_SECRET_KEY=dev-bypass` with register token `dev-bypass` (no network call). Production `.env` must use real keys.

### 7.4 CI
`.github/workflows/ci.yml` runs on `pull_request`: `npm run typecheck`, `npm run test:unit`, `npm run test:frontend`. Full e2e/workflow stays local/compose so CI does not need recaptcha secrets.

### 7.5 Documented follow-ons (not implemented)
IP bans, mute/block lists, and suspension appeals remain out of scope for this milestone.
