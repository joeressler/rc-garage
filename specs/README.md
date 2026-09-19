# RC Car & Rock Crawler Garage - Milestone Implementation Roadmap

This directory contains the sequential milestone specification files for building the **RC Car & Rock Crawler Garage & Setup Logger**. Each milestone provides unambiguous technical directives, target file paths, contracts, algorithms, and acceptance criteria designed for autonomous coding agents to implement incrementally.

---

## Milestone Execution Sequence

| # | Milestone Specification Document | Primary Domain | Core Deliverables |
| :- | :--- | :--- | :--- |
| **01** | [`01_DEV_OPS_INFRASTRUCTURE.md`](./01_DEV_OPS_INFRASTRUCTURE.md) | DevOps & Containers | Multi-stage Dockerfiles, Docker Compose with 640MB combined RAM limits, and host Nginx reverse proxy configuration. |
| **02** | [`02_DATABASE_RELATIONAL_SCHEMA.md`](./02_DATABASE_RELATIONAL_SCHEMA.md) | PostgreSQL Database | DDL migrations, relational tables (`users`, `vehicles`, `setups`, `setup_likes`), foreign keys, cascade rules, and JSONB GIN indexes. |
| **03** | [`03_BACKEND_CORE_AND_AUTH.md`](./03_BACKEND_CORE_AND_AUTH.md) | NestJS & Authentication | Global Zod validation pipe, standardized REST response envelope, JWT strategy, registration, and login. |
| **04** | [`04_VEHICLES_FLEET_MANAGEMENT.md`](./04_VEHICLES_FLEET_MANAGEMENT.md) | Vehicles API | Fleet vehicle registration, scale/class validation, vehicle fleet listing, updates, and soft-delete endpoints. |
| **05** | [`05_SETUP_LOGGING_ENGINE.md`](./05_SETUP_LOGGING_ENGINE.md) | Setups & Telemetry | Complex setup validation (drivetrain, suspension, tires/weights), live FDR calculation, CoG bias computation, and JSONB persistence. |
| **06** | [`06_FORK_ECOSYSTEM_AND_LINEAGE.md`](./06_FORK_ECOSYSTEM_AND_LINEAGE.md) | Cloning & Provenance | Forking logic, atomic lineage pointer tracking (`forked_from_setup_id`, `root_ancestor_setup_id`), and setup diff engine. |
| **07** | [`07_QR_ENGINE_AND_CHASSIS_STICKERS.md`](./07_QR_ENGINE_AND_CHASSIS_STICKERS.md) | QR Engine & Edge Route | Level 'H' error-resilient QR code generation (SVG/PNG) and `GET /qr/resolve/:slug` public inspection JSON. SPA `/s/:slug` view and sticker printer TSX are Milestone 09. |
| **08** | [`08_COMMUNITY_FEED_AND_DISCOVERY.md`](./08_COMMUNITY_FEED_AND_DISCOVERY.md) | Community Feed & Likes | Public setup discovery feed with multi-vector filtering (surface, model, class), keyset cursor pagination, and like toggles. |
| **09** | [`09_FRONTEND_SHELL_DESIGN_TOKENS_AUTH.md`](./09_FRONTEND_SHELL_DESIGN_TOKENS_AUTH.md) | Frontend Shell & Auth | React 18 + Vite SPA scaffold, Tailwind Pit-Mat design tokens, `useAuthStore`, master layout, unauthenticated `/s/:slug` `PublicInspectionView`, and `ChassisStickerPrinter`. |
| **10** | [`10_GARAGE_FLEET_MANAGEMENT_UI.md`](./10_GARAGE_FLEET_MANAGEMENT_UI.md) | Garage UI & Store | `useGarageStore`, chassis bay cards, fleet grid, vehicle creation modal, and active vehicle selector. |
| **11** | [`11_SETUP_SHEET_CLIPBOARD_AND_CALCULATOR.md`](./11_SETUP_SHEET_CLIPBOARD_AND_CALCULATOR.md) | Setup Editor & Math Store | `useSetupStore`, clipboard header clamp with scrutineering stamp, live FDR sliders, CoG balance bars, and shock dyno cards. |
| **12** | [`12_COMMUNITY_FEED_DIFF_AND_PRINTER.md`](./12_COMMUNITY_FEED_DIFF_AND_PRINTER.md) | Community UI & Printer | Community feed workbench, filter drawer, side-by-side fork diff inspector, 1.5" vinyl chassis sticker printer modal, and E2E verification. |
| **13** | [`13_ADMIN_CONSOLE_AND_MODERATION.md`](./13_ADMIN_CONSOLE_AND_MODERATION.md) | Admin Console & Moderation | Role-gated Scrutineering Desk, user suspend/reinstate, setup force-hide/delete, JWT role guards, moderation audit log, and admin E2E coverage. |
| **14** | [`14_PRODUCTION_CLEANUP_AND_OPERATIONAL_EXCELLENCE.md`](./14_PRODUCTION_CLEANUP_AND_OPERATIONAL_EXCELLENCE.md) | Production Readiness & Docs | Developer onboarding runbook, AGENTS.md, CONTRIBUTING.md, ARCHITECTURE.md, crawler SVG favicon, and workspace orchestration. |
| **15** | [`15_ACCOUNT_LIFECYCLE_AND_EMAIL.md`](./15_ACCOUNT_LIFECYCLE_AND_EMAIL.md) | Account Lifecycle & Email | Email verification, password reset/change, age attestation, profile bio/avatar URL, account self-delete, and unverified-driver gate on community writes. |
| **16** | [`16_PUBLIC_HARDENING_LEGAL_AND_REPORTS.md`](./16_PUBLIC_HARDENING_LEGAL_AND_REPORTS.md) | Hardening, Legal & Reports | Nest throttling, Google reCAPTCHA v2 on register, Terms/Privacy/Guidelines, driver report queue, host TLS/backup/CI runbook. |
| **17** | [`17_DRIVER_PROFILES_AND_COMMUNITY_QOL.md`](./17_DRIVER_PROFILES_AND_COMMUNITY_QOL.md) | Public Profiles & QoL | Public `/u/:callsign` profiles, avatars, tag editor and feed filters, copy `/s/:slug`, guest landing on the feed. |
| **18** | [`18_SOCIAL_SHARE_PREVIEWS_AND_SEO.md`](./18_SOCIAL_SHARE_PREVIEWS_AND_SEO.md) | Share Previews & SEO | Crawler-visible HTML + Open Graph for `/s/:slug`, robots.txt, sitemap of public sheets. |
| **19** | [`19_SETUP_SHEET_COMMENTS.md`](./19_SETUP_SHEET_COMMENTS.md) | Setup Comments | Flat comments on public sheets, author delete, moderator hide, reports against comment ids. |
| **20** | [`20_IN_APP_NOTIFICATIONS.md`](./20_IN_APP_NOTIFICATIONS.md) | In-App Notifications | REST notification bell for like, fork, comment, and report outcomes (no WebSockets or email). |

Milestones **15–20** are the public-community readiness sequence. Implement them in order: 15 and 16 before 19; 19 before 20. They keep the product a **setup-sheet community** (garage, clipboard, feed, fork, QR), not a general social network.

### Deferred (not scheduled)
The following stay out of 15–20 and must not be smuggled into those implementations:

- Follow / friend graphs and personalized ranking
- Direct messages / inbox
- OAuth / SSO and 2FA
- PWA / service workers
- Analytics beacons
- Chassis or setup photo uploads and CDN
- Stories, mentions, nested comment threads, and email notification digests

---

## Architectural Reference
For complete theoretical background, design tokens, mathematical formulas, and system topology diagrams, refer to the master [TECHNICAL_SPECIFICATION.md](../TECHNICAL_SPECIFICATION.md).
