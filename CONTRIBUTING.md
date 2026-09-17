# Contributing to RC Car & Rock Crawler Garage

Thank you for your interest in contributing to the **RC Car & Rock Crawler Garage & Setup Logger**! This project is built by and for RC racers, rock crawlers, and engineers who demand telemetry-grade accuracy and rock-solid software quality.

Please read this guide before submitting issues, creating feature requests, or opening pull requests.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone regardless of level of experience, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

All contributors and maintainers are expected to conduct themselves professionally and respectfully in all project spaces.

---

## Development Workflow & Branching Strategy

To keep the git history clean and traceable, we follow a strict branching and merge workflow:

### Branch Naming Conventions
- **Feature Branches:** `feature/<kebab-case-description>` (e.g. `feature/axial-capra-telemetry`)
- **Bug Fix Branches:** `fix/<kebab-case-description>` (e.g. `fix/fdr-precision-rounding`)
- **Documentation Branches:** `docs/<kebab-case-description>` (e.g. `docs/update-pinion-guide`)
- **Cloud Agent Branches:** `agent/<kebab-case-description>-188b`

### Git Practices
- Always branch off the latest `main` branch: `git fetch origin main ; git checkout -b feature/my-feature`
- Make atomic, focused commits that encapsulate a single logical change.
- Never force push (`git push --force`) to shared branches.
- Never amend pushed commits.

---

## Commit Message Conventions

We adhere to the **Conventional Commits** specification. Commit messages must be structured as follows:

```text
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Allowed Commit Types
- `feat`: A new user-facing or API feature.
- `fix`: A bug fix.
- `docs`: Documentation updates only.
- `refactor`: A code change that neither fixes a bug nor adds a feature.
- `perf`: A code change that improves execution or memory performance.
- `test`: Adding missing tests or correcting existing tests.
- `chore`: Build process, dependency updates, or auxiliary tool changes.

### Examples
- `feat(drivetrain): add internal ratio lookup table for Traxxas TRX-4`
- `fix(qr): prevent QR text overflow on 1.5 inch sticker exports`
- `docs(getting-started): clarify bare-metal postgres migration steps`

---

## Coding Standards & Architectural Guidelines

### 1. General Principles
- **Modularity & DRY:** Avoid code duplication. Factor common utilities into shared modules.
- **Readability over Cleverness:** Code should be self-evident. Favor clear variable and function names over obscure one-liners.
- **Comments Purpose Rule:** Comments MUST explain *why* something is done (intent, physics formulas, edge cases), NOT *what* is done. Redundant narrative comments are strictly prohibited.
- **Zero Placeholders:** Never commit TODO comments, mock stubs, or empty error catch blocks.

### 2. Backend (NestJS & TypeScript)
- **Layered Architecture:** Controllers handle HTTP routing only. All business logic belongs in injectable Services.
- **Contract-Driven DTOs:** All request and response structures must validate through Zod schemas in `backend/src/contracts/`.
- **Response Envelope:** All controller endpoints must output data wrapped by the global `TransformResponseInterceptor` into the standardized response envelope:
  ```typescript
  {
    success: true,
    statusCode: 200,
    data: { ... }
  }
  ```
- **Error Handling:** Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, `ForbiddenException`). Do not emit raw string errors.

### 3. Frontend (React, Vite & Zustand)
- **Functional Components:** Use React 18 functional components with explicit TypeScript prop interfaces.
- **State Management:** Use atomic Zustand stores (`useAuthStore`, `useGarageStore`, `useSetupStore`, `useAdminStore`). Avoid heavy monolithic context providers.
- **Pit-Mat Design System:** Adhere strictly to the Tailwind Pit-Mat design tokens:
  - Base Backgrounds: `bg-pit-black` (`#0E1012`), `bg-pit-grease` (`#16191D`), `bg-pit-steel` (`#21262D`).
  - Borders: `border-pit-rubber` (`#2A313A`).
  - Accents: `text-hazard-orange` (`#FF5500`), `text-neon-radio` (`#00FF66`), `text-nitromethane` (`#FFB800`).
  - Readouts: `text-readout-bright` (`#F5F7FA`), `text-readout-dim` (`#8B949E`).

---

## Pull Request Submission Checklist

Before opening a Pull Request, ensure all quality gates pass locally:

- [ ] **Type Safety:** TypeScript builds without errors:
  ```bash
  cd backend ; npx tsc --noEmit ; cd ../frontend ; npx tsc --noEmit ; cd ..
  ```
- [ ] **Unit Tests:** All backend mathematical and helper tests pass:
  ```bash
  npm run test:unit
  ```
- [ ] **Frontend Tests:** All component and store tests pass:
  ```bash
  npm run test:frontend
  ```
- [ ] **Integration & Workflow Tests:** All API integration and e2e suites pass:
  ```bash
  npm run test:e2e ; npm run test:workflow
  ```
- [ ] **Container Bounds:** If modifying container configurations, verify the 640MB combined RAM limit in `docker-compose.yml`.
- [ ] **Documentation:** Any new endpoint or architectural change is documented in `ARCHITECTURE.md` and `GETTING_STARTED.md`.

---

## Community & Questions

Need help getting oriented?
- Check out [`GETTING_STARTED.md`](./GETTING_STARTED.md) for local setup instructions.
- Check out [`ARCHITECTURE.md`](./ARCHITECTURE.md) for data models and topology.
- Check out [`specs/`](./specs/) for the milestone roadmap.
