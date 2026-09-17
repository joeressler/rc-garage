# Autonomous Coding Agent Operational Directives (`AGENTS.md`)

This document defines the engineering protocols, execution constraints, architectural axioms, and testing standards for all autonomous AI coding agents operating on the **RC Car & Rock Crawler Garage & Setup Logger** repository.

---

## 1. Prime Directives & Execution Axioms

1. **Re-use and Inherit Existing Code:**
   - If a file, helper, contract, or component already exists for a task, **do not create something new**. Re-use and extend existing code.
   - Search the codebase using precise search tools before writing new utilities.
2. **Strict Command Delimiter Protocol:**
   - Always use the Windows semicolon delimiter `;` to separate shell commands. **NEVER use `&&`**.
   - Example: `cd backend ; npm run test:unit ; cd ..`
3. **Comments Must Describe Purpose, Not Effect:**
   - Every comment must explain the *why*, trade-offs, or constraints of a solution.
   - Never write redundant narrative comments (e.g., `// import module`, `// call service`, `// return result`).
4. **Zero Placeholder Policy:**
   - Complete every implementation in full.
   - Leave **no TODOs**, placeholders, unhandled error branches, or missing mock implementations.
5. **Read Before Editing:**
   - You must inspect and understand existing files and surrounding conventions before proposing or applying code modifications.
6. **Non-Destructive Operations:**
   - Never amend commits, force push, or leave the assigned branch unless explicitly directed.

---

## 2. System Architecture & Component Map

The repository is organized into distinct domain boundaries:

```text
/
├── backend/                       # NestJS 10 REST API Server
│   ├── src/
│   │   ├── common/                # Shared filters, interceptors, and pipes
│   │   │   ├── filters/           # Global HttpExceptionFilter -> Standard Envelope
│   │   │   ├── interceptors/      # TransformResponseInterceptor -> Standard Envelope
│   │   │   └── pipes/             # ZodValidationPipe (Contract validation)
│   │   ├── contracts/             # Canonical Zod schemas & TypeScript types
│   │   │   ├── auth.contract.ts
│   │   │   ├── vehicle.contract.ts
│   │   │   ├── setup.contract.ts
│   │   │   ├── fork.contract.ts
│   │   │   ├── qr.contract.ts
│   │   │   ├── feed.contract.ts
│   │   │   └── admin.contract.ts
│   │   ├── database/              # PostgreSQL pool service and SQL migrations
│   │   │   ├── migrations/        # Sequential numbered SQL migrations (up/down)
│   │   │   └── schema.sql         # Consolidated canonical PostgreSQL 16 DDL
│   │   └── modules/               # Feature domains (controller, service, module, DTOs)
│   │       ├── auth/              # JWT auth, user registration, bcrypt, roles
│   │       ├── vehicles/          # Digital fleet garage CRUD & class validation
│   │       ├── setups/            # Setup sheet telemetry, FDR/CoG math, diffs, likes
│   │       ├── qr/                # Level 'H' error correction QR generator & resolver
│   │       ├── feed/              # Community setup discovery & cursor pagination
│   │       └── admin/             # Scrutineering Desk moderation & audit logging
│   └── test/                      # Backend unit, integration, and e2e test suites
│
├── frontend/                      # React 18 + Vite SPA Client
│   ├── public/                    # Static assets (including favicon.svg)
│   └── src/
│       ├── api/                   # Typed HTTP fetch client wrappers using contracts
│       ├── components/            # Reusable React UI components
│       │   ├── auth/              # Auth modal (login, register)
│       │   ├── garage/            # Chassis bay cards, fleet grid, vehicle modals
│       │   ├── setup/             # Drivetrain, suspension dyno, corner balance cards
│       │   ├── diff/              # Side-by-side fork diff inspector
│       │   ├── qr/                # 1.5" physical chassis sticker printer
│       │   ├── feed/              # Community setup feed cards & filter drawers
│       │   ├── admin/             # Admin moderation tables & action modals
│       │   └── layout/            # PitMatAppLayout, DiagnosticTopBar, ToolboxDrawer
│       ├── stores/                # Zustand atomic state stores (auth, garage, setup, admin)
│       └── views/                 # Top-level workbench views matching drawer routes
│
├── docker/                        # Host Nginx and edge reverse proxy configs
├── specs/                         # Sequential milestone specifications (01 - 14)
└── tests/e2e/                     # Multi-service end-to-end integration workflows
```

---

## 3. Strict Contract & Communication Rules

### Canonical Contracts as Single Source of Truth
- All HTTP requests, query parameters, path variables, and response payloads must be governed by schemas defined in `backend/src/contracts/`.
- Frontend API clients must consume these contracts to guarantee type parity with backend validations.

### Standardized REST Response Envelope
Every backend route must format its output through the standard response envelope:
```typescript
export interface ApiResponseEnvelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: string;
  message?: string[];
}
```
Direct controller returns must be intercepted by `TransformResponseInterceptor` or explicitly returned with this structure.

---

## 4. Container Resource Constraints & Network Bounds

All containerized deployments must conform to the strict limits defined in `docker-compose.yml`:

| Service | Container Name | RAM Limit | RAM Reservation | CPU Cap | Host Ports |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Database** | `rc-db` | `256MB` | `128MB` | `0.50` | *None* (isolated to bridge network) |
| **Backend API** | `rc-backend` | `256MB` | `128MB` | `0.50` | `127.0.0.1:5742:5742` |
| **Frontend SPA** | `rc-frontend` | `128MB` | `64MB` | `0.25` | `127.0.0.1:3742:3742` |
| **Combined** | — | **`640MB`** | `320MB` | `1.25` | *Loopback only* |

- The NestJS Node.js process MUST execute with `--max-old-space-size=192` to avoid container eviction under load.
- PostgreSQL buffers MUST be tuned for low memory (`shared_buffers=64MB`, `work_mem=4MB`, `max_connections=40`).

---

## 5. Telemetry & Mathematical Integrity

When working with setup sheet calculations, verify implementations against the physical mechanics:

1. **Final Drive Ratio (FDR):**
   $$\text{FDR} = \left(\frac{\text{spur\_teeth}}{\text{pinion\_teeth}}\right) \times \text{internal\_ratio}$$
   *Must be calculated to 2 decimal places.*
2. **Rollout (Distance Traveled per Motor Revolution):**
   $$\text{Rollout} = \frac{\text{tire\_diameter\_mm} \times \pi}{\text{FDR}}$$
3. **Center of Gravity (CoG) Front Bias Percentage:**
   $$\text{Front Bias \%} = \frac{W_{\text{front\_left}} + W_{\text{front\_right}}}{W_{\text{gross}}} \times 100$$
   *Where $W_{\text{gross}} = W_{\text{front\_left}} + W_{\text{front\_right}} + W_{\text{rear\_left}} + W_{\text{rear\_right}}$.*
4. **Shock Oil Viscosity Normalization:**
   - Normalization lookup between CST and WT ratings must follow verified physical rating tables in `backend/src/modules/setups/utils/telemetry-math.util.ts`.

---

## 6. Provenance & Fork Lineage Rules

- Setup forking creates an independent, decoupled copy of telemetry settings in the recipient driver's garage.
- Every fork must maintain immutable pointers:
  - `forked_from_setup_id`: Points to the immediate parent setup.
  - `root_ancestor_setup_id`: Points to the original progenitor of the fork tree.
- When ancestor setups are deleted, foreign key constraints must use `ON DELETE SET NULL` to preserve fork trees without orphan corruption.
- Diffing between parent and child setups must highlight differences using the Pit-Mat `text-nitromethane` color token.

---

## 7. QR Engine & Sticker Standards

- QR generation must strictly enforce **Error Correction Level 'H'** (30% area recovery capability) to guarantee scannability through mud, dust, and scratch damage.
- The sticker printer modal must compose `ChassisStickerPrinter` and produce:
  - Scalable Vector Graphics (SVG) for plotter/cutter output.
  - 300 DPI high-contrast PNG bitmap for vinyl sticker printing.
- Canonical short URL embedded in QR codes must resolve to `/s/:slug`.

---

## 8. Verification & Gatekeeping Workflow

Before submitting any code change:
1. Run backend unit tests: `npm run test:unit`.
2. Run backend integration & e2e tests: `npm run test:e2e`.
3. Run comprehensive workflow tests: `npm run test:workflow`.
4. Run frontend tests: `npm run test:frontend`.
5. Verify TypeScript compilation without emit errors:
   - Backend: `cd backend ; npx tsc --noEmit ; cd ..`
   - Frontend: `cd frontend ; npx tsc --noEmit ; cd ..`
