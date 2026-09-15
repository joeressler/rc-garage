# Milestone 01: DevOps Infrastructure & Container Runtime Environment

## 1. Objective
Establish the isolated multi-container runtime environment, directory layout, Dockerfiles, Docker Compose configuration, and host Nginx reverse proxy architecture for the RC Car & Rock Crawler Garage & Setup Logger.

---

## 2. Scope & Target Files
- `/docker-compose.yml`
- `/docker/frontend-nginx.conf`
- `/docker/host-nginx.conf.example`
- `/frontend/Dockerfile`
- `/backend/Dockerfile`
- `/.env.example`
- `/.gitignore`

---

## 3. Detailed Technical Requirements

### 3.1 Directory Topology
```
rc-garage/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
├── docker/
│   ├── frontend-nginx.conf
│   └── host-nginx.conf.example
├── specs/
├── docker-compose.yml
└── .env.example
```

### 3.2 Frontend Container Specification (`frontend/Dockerfile`)
- **Stage 1 (`builder`):**
  - Base: `node:20-alpine`.
  - Copy `package.json`, `package-lock.json`. Execute `npm ci`.
  - Copy source code and build production bundle via `npm run build`.
- **Stage 2 (`runner`):**
  - Base: `nginxinc/nginx-unprivileged:alpine-slim`.
  - Non-root user: `nginx` (UID 101).
  - Copy custom Nginx configuration into `/etc/nginx/conf.d/default.conf`.
  - Copy compiled SPA dist from builder stage to `/usr/share/nginx/html`.
  - Expose internal container port `3742` (non-standard to avoid collisions with common 3000/8080 dev servers).
  - Container Nginx must `listen 3742` to match.
  - Set `STOPSIGNAL SIGQUIT`.

### 3.3 Backend Container Specification (`backend/Dockerfile`)
- **Stage 1 (`builder`):**
  - Base: `node:20-alpine`.
  - Install dependencies including devDependencies with `npm ci`.
  - Compile NestJS TypeScript application with `npm run build`.
  - Prune devDependencies with `npm prune --production`.
- **Stage 2 (`runner`):**
  - Base: `node:20-alpine`.
  - Non-root user: `node` (UID 1000).
  - Copy `package.json`, pruned `node_modules`, and compiled `dist/` directory.
  - Expose port `5742` (non-standard to avoid collisions with common 5000/8000 services).
  - Backend must listen on environment `PORT` (default `5742`).
  - Enforce V8 memory ceiling aligned with container constraints:
    `CMD ["node", "--max-old-space-size=192", "dist/main.js"]`.

### 3.4 Docker Compose Architecture (`docker-compose.yml`)
- **Service `rc-db`:**
  - Image: `postgres:16-alpine`.
  - Isolated within internal Docker bridge network `rc-isolated-net` (no host port bindings).
  - Mount named volume `pg_data` to `/var/lib/postgresql/data`.
  - Enforce deploy memory limit: `256M`, reservation: `128M`, CPU limit: `0.50`.
  - Custom tuned PostgreSQL params:
    `-c shared_buffers=64MB -c work_mem=4MB -c maintenance_work_mem=16MB -c effective_cache_size=128MB -c max_connections=40 -c checkpoint_completion_target=0.7 -c wal_buffers=2MB`.
  - Healthcheck command: `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`.
- **Service `rc-backend`:**
  - Build context `./backend`.
  - Bind port strictly to host loopback: `127.0.0.1:5742:5742`.
  - Depends on `rc-db` with `condition: service_healthy`.
  - Enforce deploy memory limit: `256M`, reservation: `128M`, CPU limit: `0.50`.
  - Healthcheck: `wget -qO- http://127.0.0.1:5742/api/garage/health || exit 1`.
- **Service `rc-frontend`:**
  - Build context `./frontend`.
  - Bind port strictly to host loopback: `127.0.0.1:3742:3742`.
  - Depends on `rc-backend`.
  - Enforce deploy memory limit: `128M`, reservation: `64M`, CPU limit: `0.25`.

### 3.5 Host-Level Nginx Reverse Proxy (`docker/host-nginx.conf.example`)
- Rate limiting zones: `api_limit` (15 r/s), `auth_limit` (3 r/s).
- Port 80 redirects to 443 with Let's Encrypt challenge pass-through.
- Reverse proxy mapping:
  - `/api/garage/auth/` -> `http://127.0.0.1:5742` (burst 5, nodelay).
  - `/api/` -> `http://127.0.0.1:5742` (burst 20, nodelay).
  - `/` -> `http://127.0.0.1:3742`.

---

## 4. Verification & Acceptance Criteria
1. Running `docker compose config` validates without syntax errors.
2. Containers launch via `docker compose up -d` without exceeding the total 640MB memory footprint.
3. PostgreSQL is unroutable from external host ports and responds only to queries originating from `rc-backend`.
4. Backend healthcheck returns `200 OK` on `http://127.0.0.1:5742/api/garage/health`.
