# Milestone 14: Production Cleanup, Developer Onboarding, Architecture Brief & Visual Identity

## 1. Objective
Complete the production readiness lifecycle of the **RC Car & Rock Crawler Garage & Setup Logger**. Deliver comprehensive developer onboarding documentation, formalize operational rules and protocols for autonomous coding agents (`AGENTS.md`) and open-source human contributors (`CONTRIBUTING.md`), synthesize an executive architectural brief (`ARCHITECTURE.md`), establish a root workspace development orchestrator, and replace placeholder iconography with an authentic, vector-crafted scale RC rock crawler SVG favicon in the Pit-Mat design system.

---

## 2. Scope & Target Files
- `/specs/14_PRODUCTION_CLEANUP_AND_OPERATIONAL_EXCELLENCE.md` (This milestone specification)
- `/specs/README.md` (Milestone execution roadmap registration)
- `/README.md` (Repository root project overview and quick reference)
- `/GETTING_STARTED.md` (Comprehensive step-by-step developer onboarding & runbook)
- `/AGENTS.md` (Operational constraints, architecture axioms, and workflows for AI agents)
- `/CONTRIBUTING.md` (Contributor conventions, branching strategy, and quality gates)
- `/ARCHITECTURE.md` (Executive architectural blueprint, network topology, telemetry formulas, and schemas)
- `/frontend/public/favicon.svg` (Handcrafted vector RC rock crawler favicon)
- `/package.json` (Root orchestrator for unified workspace build, test, and lint commands)
- `/.env.example` (Complete production environment variable audit)

---

## 3. Detailed Technical Requirements

### 3.1 Developer Onboarding & Quickstart (`GETTING_STARTED.md` & `README.md`)
1. **Prerequisites & Tooling:**
   - Node.js >= 20 LTS
   - npm >= 10
   - Docker Engine >= 24 & Docker Compose v2
   - PostgreSQL 16 (for non-containerized bare-metal development)
2. **Containerized Deployment (Docker Compose):**
   - Provide copy-paste workflow: `cp .env.example .env` and `docker compose up -d --build`.
   - Explicitly detail container port mappings avoiding host conflicts:
     - Frontend SPA: `http://127.0.0.1:3742`
     - Backend API: `http://127.0.0.1:5742/api/garage/health`
     - Database: `rc-db:5432` isolated to Docker bridge network `rc-isolated-net` without exposed host ports.
3. **Local Bare-Metal Development:**
   - Step-by-step backend dependency installation, database migration (`npm run migration:up`), and development server startup.
   - Frontend Vite HMR dev server launch and API proxy mechanics.
4. **End-to-End Walkthrough Scenarios:**
   - Account registration and vehicle fleet entry (scale and class taxonomy).
   - Setup sheet configuration (drivetrain ratios, suspension geometry, corner weights, CoG balance).
   - Forking community setups and inspecting mechanical diffs.
   - Physical chassis sticker generation (Level 'H' error correction QR code).
   - Administrative moderation desk access for elevated roles.
5. **Operational Runbook & Troubleshooting:**
   - Port collision remedies, container memory troubleshooting, database migration rollback procedures.

### 3.2 Agent Operational Guidelines (`AGENTS.md`)
1. **System & Terminal Protocols:**
   - Windows semicolon delimiter requirement: Always use `;` as a terminal command delimiter, NEVER `&&`.
   - Non-destructive workspace operations: Never delete, reset, or force push git history unless explicitly directed.
2. **Architectural Axioms:**
   - Contract-driven single source of truth: Zod schemas in `backend/src/contracts/` dictate API input/output structures.
   - Uniform REST response envelope: Every endpoint wraps responses in `{ success: boolean, statusCode: number, data?: T, error?: string, message?: string[] }`.
   - Strict container memory bounds: 640MB combined RAM allocation (`rc-db`: 256MB, `rc-backend`: 256MB with `--max-old-space-size=192`, `rc-frontend`: 128MB).
3. **Engineering Standards:**
   - Reuse existing utilities, stores, and components; avoid duplicating logic.
   - Prioritize modularity, DRY principles, readability, and security.
   - Comments must describe purpose, not effect.
   - Zero-placeholder rule: no missing types, mock bypasses, or TODO stubs.

### 3.3 Contributor Standards (`CONTRIBUTING.md`)
1. **Branching & Git Workflows:**
   - Feature branches: `feature/<feature-name>`.
   - Bugfix branches: `fix/<bug-name>`.
   - Cloud Agent branches: `agent/<task-name>-188b`.
2. **Commit Style:**
   - Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
   - Atomic commits per logical change.
3. **Quality Gates & PR Checklist:**
   - Clean TypeScript check across backend and frontend (`tsc --noEmit`).
   - Unit and integration tests passing (`npm run test:e2e`, `vitest run`).
   - Docker build validation.

### 3.4 Executive Architectural Blueprint (`ARCHITECTURE.md`)
1. **System Topology & Container Isolation:**
   - Ingress, host Nginx reverse proxy, internal Docker network `rc-isolated-net`, non-standard loopback ports (3742, 5742).
2. **Relational Data Model & Lineage Graphs:**
   - `users`, `vehicles`, `setups`, `setup_likes`, `moderation_audit_log`.
   - Setup lineage pointers: `forked_from_setup_id` and `root_ancestor_setup_id` with `ON DELETE SET NULL`.
   - JSONB telemetry document schema and indexing strategies.
3. **Telemetry & Mechanical Math:**
   - FDR formula: $\text{FDR} = \left(\frac{\text{spur}}{\text{pinion}}\right) \times \text{internal\_ratio}$.
   - Rollout formula: $\text{Rollout} = \frac{\text{tire\_diameter\_mm} \times \pi}{\text{FDR}}$.
   - CoG Front Weight Bias %: $\text{Bias}_{\text{front}} = \frac{W_{\text{front\_left}} + W_{\text{front\_right}}}{W_{\text{gross}}} \times 100$.
4. **Physical QR Chassis Sticker Pipeline:**
   - Level 'H' Error Correction Code (ECC) algorithm for 30% area damage tolerance.
   - Resolution optimization for 1.5" x 1.5" vinyl decals and 300 DPI exports.
5. **Security, Auth & Role-Based Moderation:**
   - JWT stateless token lifecycle, bcrypt password hashing.
   - Role hierarchy (`driver`, `moderator`, `admin`) and Scrutineering Desk moderation model.

### 3.5 Vector RC Rock Crawler Favicon (`frontend/public/favicon.svg`)
1. **Visual Elements:**
   - Scalable 64x64 vector viewport (`viewBox="0 0 64 64"`).
   - High-contrast rounded dark pit-mat base (`#0E1012`) with border (`#2A313A`).
   - Scale rock crawler silhouette:
     - Oversized deep-tread off-road crawler beadlock tires (`#16191D`, `#2A313A`).
     - Dual anodized neon-radio (`#00FF66`) beadlock rings with hex hardware detailing.
     - Articulated 4-link suspension arms in pit steel (`#21262D`).
     - High-travel coilover shock springs in neon radio (`#00FF66`).
     - Heavy-duty tubular rock bouncer roll cage and stinger bumper in hazard orange (`#FF5500`).
     - High-intensity roof-mounted LED light bar (`#F5F7FA` with `#00FF66` glow).
2. **Format & Verification:**
   - Clean, valid SVG XML without external font dependencies.
   - Crisp rendering across 16x16, 32x32, 48x48, and 64x64 pixel rasterizations.

### 3.6 Production Hygiene & Workspace Coordination
1. **Root `package.json`:**
   - Provide workspace-level scripts: `npm run build`, `npm run test`, `npm run lint`.
2. **Environment Template (`.env.example`):**
   - Validate that all database credentials, secrets, ports, and admin bootstrap parameters are documented.

---

## 4. Verification & Acceptance Criteria
1. Full test suites pass across frontend and backend.
2. Root README, GETTING_STARTED, AGENTS, CONTRIBUTING, and ARCHITECTURE documents are complete, accurate, and cross-referenced.
3. SVG favicon renders an authentic scale rock crawler matching the Pit-Mat design palette.
4. Execution roadmap in `specs/README.md` properly references Milestone 14.
