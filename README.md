# RC Car & Rock Crawler Garage & Setup Logger

> Telemetry-grade setup sheet logging, fork lineage ecosystem, and physical QR chassis stickers for competitive RC racers, scale rock crawlers, and basher enthusiasts.

---

## Overview

The **RC Car & Rock Crawler Garage & Setup Logger** is a production-grade web application tailored specifically for the radio control hobby. It solves the fragmentation of paper setup sheets, lost tuning notes, and disconnected forum posts by providing:

1. **Digital Vehicle Fleet Management:** Track chassis across competitive scales (`1/24`, `1/18`, `1/10`, `1/8`, `1/7`, `1/5`) and classes (`crawler_scale`, `comp_crawler_pro`, `buggy_4wd`, `touring_onroad`, etc.).
2. **Setup Sheet Clipboard & Calculators:** Real-time Final Drive Ratio (FDR) and Rollout calculator, Center of Gravity (CoG) corner weight balance visualizer, and front/rear suspension dyno settings (viscosity normalization in WT and CST).
3. **Decentralized Fork Ecosystem:** Fork setups from community drivers with immutable lineage tracking (`forked_from_setup_id`, `root_ancestor_setup_id`) and side-by-side mechanical delta diffing.
4. **Physical QR Chassis Stickers:** Generate high-contrast, Level 'H' error-resilient QR codes formatted for 1.5" x 1.5" vinyl chassis decals and mobile trackside inspection at `/s/:slug`.
5. **Community Feed & Moderation Console:** Discover setups with multi-vector filtering (surface type, scale, class), like setups, and manage platform safety via the role-gated Scrutineering Desk (`/admin`).

Built with the **Pit-Mat** industrial workbench visual design token system (dark-mode-first aesthetic with hazard orange, neon radio green, and nitromethane yellow accents).

---

## Quickstart

### 1. Fast Launch with Docker Compose (Recommended)

The easiest way to run the entire stack with isolated networking and bounded resource limits:

```bash
# Clone the repository and enter the directory
cd rc-garage

# Copy the environment template
cp .env.example .env

# Start all services (PostgreSQL, NestJS API, React SPA)
docker compose up -d --build
```

Access the application:
- **Pit-Mat Web Workbench:** [http://127.0.0.1:3742](http://127.0.0.1:3742)
- **NestJS REST API Health Check:** [http://127.0.0.1:5742/api/garage/health](http://127.0.0.1:5742/api/garage/health)
- **Database:** Internal PostgreSQL 16 on `rc-isolated-net` (no host port exposed)

To view real-time logs:
```bash
docker compose logs -f
```

To stop the services:
```bash
docker compose down
```

---

## Documentation & Architecture Map

| Document | Purpose |
| :--- | :--- |
| **[`GETTING_STARTED.md`](./GETTING_STARTED.md)** | Step-by-step developer onboarding, bare-metal local setup, walkthrough scenarios, and operational troubleshooting runbook. |
| **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** | Executive architectural brief, system topology, container isolation, telemetry math formulas, and relational data schemas. |
| **[`AGENTS.md`](./AGENTS.md)** | Operational guidelines, architectural axioms, memory budgets, and command protocols for autonomous AI coding agents. |
| **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** | Open-source guidelines, Git branching conventions, Conventional Commits standard, and pull request quality gates. |
| **[`TECHNICAL_SPECIFICATION.md`](./TECHNICAL_SPECIFICATION.md)** | Comprehensive blueprint detailing all engineering requirements, contracts, and mathematical models. |
| **[`specs/`](./specs/)** | Incremental milestone specification documents from Milestone 01 to Milestone 14. |

---

## Technology Stack

```
+---------------------------------------------------------------------------------+
|                                Host Ingress / Edge                              |
|                          (Nginx TLS Termination / Reverse Proxy)                |
+--------------------+------------------------------------+-----------------------+
                     |                                    |
       Proxy Pass    | 127.0.0.1:3742                     | 127.0.0.1:5742
       Location /    v                                    v Location /api/
+---------------------------------------------------------------------------------+
|                       Docker Bridge Network (rc-isolated-net)                   |
|                                                                                 |
|  +-------------------------+                 +-------------------------------+  |
|  |       rc-frontend       |                 |          rc-backend           |  |
|  |  - React 18 SPA + Vite  |                 |  - NestJS 10 (TypeScript)     |  |
|  |  - Zustand Stores       |                 |  - Zod Request Validation     |  |
|  |  - Tailwind Pit-Mat CSS |                 |  - JWT Stateless Auth         |  |
|  |  - Max RAM: 128 MB      |                 |  - QR Code Engine (Level 'H') |  |
|  +-------------------------+                 |  - Max RAM: 256 MB            |  |
|                                              +---------------+---------------+  |
|                                                              |                  |
|                                              Internal Bridge | TCP 5432         |
|                                              (No Host Port)  v                  |
|                                              +-------------------------------+  |
|                                              |             rc-db             |  |
|                                              |  - PostgreSQL 16 (Alpine)     |  |
|                                              |  - Tuned Buffers (64MB shared)|  |
|                                              |  - Max RAM: 256 MB            |  |
|                                              +---------------+---------------+  |
+--------------------------------------------------------------|------------------+
                                                   Named Mount v
                                               Volume: rc_garage_pg_data
```

- **Frontend:** React 18, TypeScript 5, Vite 5, Zustand 4, Tailwind CSS 3, Vitest.
- **Backend:** NestJS 10, Node.js 20 LTS, Zod 3, Passport JWT, bcryptjs, qrcode, pg.
- **Database:** PostgreSQL 16 (Alpine) with UUIDv4 (`pgcrypto`), JSONB indexing, and relational foreign keys.
- **Deployment:** Docker & Docker Compose with a hard 640MB combined RAM cap across all containers.

---

## Testing & Verification

Run the unified test commands from the project root:

```bash
# Run all backend unit and calculation math tests
npm run test:unit

# Run full backend end-to-end integration suite
npm run test:e2e

# Run frontend Vitest test suite
npm run test:frontend

# Run full multi-driver garage workflow verification
npm run test:workflow
```

---

## License

This project is licensed under the MIT License — see the [`LICENSE`](./LICENSE) file for details.
