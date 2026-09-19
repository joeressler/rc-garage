
# Milestone 16: Public Hardening, Legal Pages & Driver Reports

## 1. Objective
Make the existing pit-mat stack defensible on a public hostname: application-level throttling, Google reCAPTCHA v2 on registration, crawlable legal documents with a register checkbox, and a driver-initiated report queue that the Scrutineering Desk can action without a second admin product. Host TLS, nginx `limit_req`, and `pg_dump` backups are specified as runbook + example artifacts (compose still binds loopback). Block lists, appeals, and DMs stay out of scope.

**Product framing:** reports protect setup-sheet integrity (spam, abuse, stolen content), not a general social graph.

**Depends on:** Milestone 13 (admin console, `moderation_audit_log`) and Milestone 15 (age attestation + self-delete on the register/settings forms). **Unblocks:** 19 (comment as a report `targetType`).

---

## 2. Scope & Target Files
- `/backend/src/database/migrations/005_content_reports.up.sql` (next sequential number after 15's lifecycle migration)
- `/backend/src/database/migrations/005_content_reports.down.sql`
- `/backend/src/database/schema.sql`
- `/backend/src/main.ts` (Helmet)
- `/backend/src/app.module.ts` (`ThrottlerModule`, `ThrottlerGuard`)
- `/backend/src/modules/auth/guards/recaptcha.guard.ts` (new)
- `/backend/src/modules/auth/auth.controller.ts` (reCAPTCHA on register)
- `/backend/src/contracts/auth.contract.ts` (`recaptchaToken` on register)
- `/backend/src/contracts/report.contract.ts` (new)
- `/backend/src/contracts/admin.contract.ts` (report list/action schemas + overview KPI)
- `/backend/src/modules/reports/reports.module.ts` (new)
- `/backend/src/modules/reports/reports.controller.ts` (new)
- `/backend/src/modules/reports/reports.service.ts` (new)
- `/backend/src/modules/admin/admin.controller.ts`
- `/backend/src/modules/admin/admin.service.ts`
- `/frontend/src/api/reports.ts` (new)
- `/frontend/src/api/auth.ts` (register reCAPTCHA field)
- `/frontend/src/components/auth/AuthModal.tsx` (legal checkboxes + reCAPTCHA v2 widget)
- `/frontend/src/views/LegalDocumentView.tsx` (new)
- `/frontend/src/content/legal/terms.md`
- `/frontend/src/content/legal/privacy.md`
- `/frontend/src/content/legal/community-guidelines.md`
- `/frontend/src/App.tsx` (`/legal/terms`, `/legal/privacy`, `/legal/guidelines`)
- `/frontend/src/components/feed/SetupInspectOverlay.tsx` (Report control)
- `/frontend/src/components/feed/ReportSetupModal.tsx` (new)
- `/frontend/src/components/admin/ReportQueuePanel.tsx` (new)
- `/frontend/src/views/AdminConsoleWorkbench.tsx`
- `/frontend/src/stores/useAdminStore.ts`
- `/docker/host-nginx.conf.example` (already has `limit_req`; confirm auth/API zones remain)
- `/GETTING_STARTED.md` (TLS apply steps, `pg_dump` backup, restore)
- `/scripts/backup-pg.sh` (or `.ps1` companion documented for Windows agents)
- `/.github/workflows/ci.yml`
- `/.env.example` (`RECAPTCHA_SECRET_KEY`, `VITE_RECAPTCHA_SITE_KEY`)
- `/backend/test/hardening-reports.spec.ts`
- `/tests/e2e/admin-moderation.spec.ts` (extend) and/or `/tests/e2e/content-reports.spec.ts`
- `/frontend/src/components/auth/AuthModal.test.tsx` (legal + reCAPTCHA wiring)

---

## 3. Detailed Technical Requirements

### 3.1 Nest Helmet
In `backend/src/main.ts`, enable `helmet` with defaults compatible with the Pit-Mat SPA (do not set `Content-Security-Policy` so strict that Vite inline, Google Fonts, or the reCAPTCHA script origins `www.google.com` / `www.gstatic.com` break until a follow-on CSP milestone). At minimum: `X-Content-Type-Options`, `X-Frame-Options` (SPA may still be framed only by itself; `SAMEORIGIN` is acceptable), hide `X-Powered-By`.

CORS stays **disabled** for the compose topology (frontend nginx already `proxy_pass` `/api/` same-origin). Document that split-origin deploys must set CORS explicitly later.

### 3.2 Throttling
Install `@nestjs/throttler` globally:

- Default: 60 requests / 60 seconds / IP for `/api/garage/*`
- Override on `POST /auth/register` and `POST /auth/login`: 5 requests / 60 seconds / IP
- `429 Too Many Requests` through the standard envelope (`success: false`, `error: "Too Many Requests"`)

Host nginx `limit_req` in `/docker/host-nginx.conf.example` remains **required at the public edge** (`api_limit` 15r/s, `auth_limit` 3r/s). Nest limits are defense in depth for loopback and misconfigured edges. Implementation must not remove those nginx zones.

E2E should not flake: use a test env `THROTTLE_DISABLED=true` honored only when `NODE_ENV=test`.

### 3.3 Google reCAPTCHA v2 (registration only)
Provider is **Google reCAPTCHA v2 Checkbox** (“I'm not a robot”). Do **not** ship a homemade image/text captcha, Cloudflare Turnstile, hCaptcha, or reCAPTCHA v3 score checks in this milestone.

Env:
```
RECAPTCHA_SECRET_KEY=
VITE_RECAPTCHA_SITE_KEY=
```

Create a v2 **Checkbox** key pair in the [Google reCAPTCHA admin console](https://www.google.com/recaptcha/admin). Use the same keys in backend secret + Vite site key. Document domain allowlisting (`localhost` plus the public hostname) in GETTING_STARTED.

- Register body adds `recaptchaToken: z.string().min(1)`.
- `RecaptchaGuard` POSTs `https://www.google.com/recaptcha/api/siteverify` as `application/x-www-form-urlencoded` with `secret`, `response` (the token), and `remoteip` (`X-Forwarded-For` first hop when present).
- Treat `success !== true` as failure. Do not require a v3 `score` field.
- Failure: `400` `"reCAPTCHA verification failed"`.
- **Dev/test bypass:** when `RECAPTCHA_SECRET_KEY` is empty or `dev-bypass`, accept token `dev-bypass` and skip the network call. Production `.env` must set real keys; document this in GETTING_STARTED.

Login does **not** require reCAPTCHA (throttling covers brute force). Forgot-password is not in this milestone (deferred until a mailer exists).

Frontend: load `https://www.google.com/recaptcha/api.js` (or `react-google-recaptcha` wrapping that script) on register mode only; send the widget token in `apiRegister`. Reset the widget after a failed register so the driver must solve a fresh challenge. Legal checkboxes (3.4) are independent.

Privacy: Google's terms require disclosing reCAPTCHA and linking Google's [Privacy Policy](https://policies.google.com/privacy) and [Terms of Use](https://policies.google.com/terms) from `/legal/privacy` (and the register footer is allowed to repeat a one-line “protected by reCAPTCHA” notice with those two links).

### 3.4 Legal routes and register checkbox
SPA routes (Pit-Mat `LegalDocumentView`, `Inter` body copy, hazard-orange title):
- `/legal/terms`
- `/legal/privacy`
- `/legal/guidelines`

Author complete, non-placeholder markdown covering: hobby community purpose, user-generated setup sheets, no warranty of mechanical safety, moderation (hide/suspend), account deletion (Milestone 15), cookies/JWT in localStorage, Google reCAPTCHA on registration (including links to Google's Privacy Policy and Terms of Use), contact via operator email placeholder `operators@localhost`.

Register form (after age attestation from 15) requires:
```typescript
acceptedLegal: z.literal(true);
```
Copy: “I agree to the Terms, Privacy Policy, and Community Guidelines” with links opening the legal routes in a new tab. Persist nothing extra if `age_attested_at` already exists; optional `legal_accepted_at TIMESTAMPTZ` on `users` is allowed if the implementer wants an audit column (include it in the 005 migration if used).

Footer or AuthModal must link the three documents for guests.

### 3.5 Content reports schema
```sql
CREATE TABLE content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('setup', 'user', 'comment')),
  target_id UUID NOT NULL,
  reason_code VARCHAR(40) NOT NULL,
  details VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_content_reports_open ON content_reports (created_at DESC) WHERE status = 'open';
CREATE INDEX idx_content_reports_target ON content_reports (target_type, target_id);
```

`comment` is a **reserved** `target_type` in this milestone: API must reject `target_type: 'comment'` with `400` until Milestone 19 wires comment IDs. Do not omit the CHECK value; 19 must not need another enum migration if the CHECK already includes `comment`.

Reason codes:
```typescript
export const ReportReasonCodeSchema = z.enum([
  'spam',
  'abuse',
  'stolen_setup',
  'malware_link',
  'other',
]);
```

### 3.6 Driver report API
`POST /api/garage/reports` — `JwtAuthGuard` (suspended accounts already fail JWT strategy).

```typescript
export const CreateReportSchema = z.object({
  targetType: z.enum(['setup', 'user']),
  targetId: z.string().uuid(),
  reasonCode: ReportReasonCodeSchema,
  details: z.string().max(500).optional(),
}).superRefine((val, ctx) => {
  if (val.reasonCode === 'other' && !val.details?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'details are required when reasonCode is other',
      path: ['details'],
    });
  }
});
```

Rules:
- Reporter cannot report themselves.
- Setup target must exist and be `is_public = TRUE` (hidden sheets: still reportable by UUID if the reporter already has the id from a prior inspect; operators need that for late reports). If setup 404s, return `404`.
- User target must exist and not be the last admin special-case; reporting a moderator is allowed.
- Duplicate open report from the same reporter + target: `409 Conflict`.
- Response `201` `{ id, status: 'open' }`.

`GET /api/garage/reports/mine` optional; not required. Drivers see a confirmation in the modal only.

### 3.7 Admin report queue
Extend `/admin/overview` with `openReportCount`.

| Method | Subpath | Roles | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/reports` | admin, moderator | cursor, limit, `status` default `open` | Paginated queue, newest first, with reporter callsign and target summary |
| `PATCH` | `/admin/reports/:id` | admin, moderator | `ResolveReportSchema` | Dismiss or action |

```typescript
export const ResolveReportSchema = z.object({
  status: z.enum(['actioned', 'dismissed']),
  reason: z.string().min(3).max(500),
  hideSetup: z.boolean().optional(),
  suspendUser: z.boolean().optional(),
});
```

When `hideSetup` is true, the report `target_type` must be `setup`; reuse `AdminService` hide path and write `moderation_audit_log` action `setup.hide` with metadata `{ reportId }`. When `suspendUser` is true, target must resolve to a user (setup reports suspend the **author**). Always write `moderation_audit_log` action `report.resolve` in the same transaction as status change.

Do **not** build a second admin app. Add `ReportQueuePanel` to `AdminConsoleWorkbench` beside existing tables. Pit-Mat: nitromethane for `open`, neon-radio for `dismissed`, hazard-orange for `actioned`.

### 3.8 Inspect overlay report control
On `SetupInspectOverlay`, authenticated drivers get a **Report sheet** control opening `ReportSetupModal` (reason select + details). Guests are prompted through existing `onRequestAuth`.

Reporting a **user** from the overlay is a secondary control on the author callsign (“Report driver”). Optional but specified: include it so `targetType: 'user'` is exercised.

### 3.9 Host ops runbook (docs + script, not live cloud)
Update `GETTING_STARTED.md` with a **Public host** section:
1. Install `/docker/host-nginx.conf.example` as the site config; provision Let’s Encrypt as already sketched in that file.
2. Never publish compose ports off `127.0.0.1`.
3. Backup: `scripts/backup-pg.sh` runs `docker compose exec -T rc-db pg_dump -U $POSTGRES_USER $POSTGRES_DB` to `backups/rc-garage-YYYYMMDD.sql` (script creates `backups/` which is gitignored). Document restore via `psql`.
4. CI: `.github/workflows/ci.yml` on pull_request runs `npm run typecheck`, `npm run test:unit`, `npm run test:frontend`. Full e2e/workflow remains local/compose (do not require secrets-heavy reCAPTCHA in CI; use bypasses).

Follow-on (document only, do not implement): IP bans, mute/block lists, suspension appeals.

---

## 4. Verification & Acceptance Criteria
1. With `THROTTLE_DISABLED` unset in a unit test double, exceeding the auth bucket returns `429` in the standard envelope.
2. Register without `recaptchaToken` returns `400`. With `RECAPTCHA_SECRET_KEY=dev-bypass` and token `dev-bypass`, register succeeds.
3. Register without `acceptedLegal: true` returns `400`. `/legal/terms`, `/legal/privacy`, and `/legal/guidelines` render non-empty policy text in the SPA.
4. Suspended JWT `POST /reports` is rejected by the existing suspension gate (`403`).
5. Authenticated driver can report a public setup; a second open report on the same target from the same driver is `409`.
6. Moderator `PATCH` with `hideSetup: true` hides the sheet from `GET /feed` and `/qr/resolve/:slug`, sets report `actioned`, and inserts `setup.hide` plus `report.resolve` audit rows.
7. `GET /admin/overview` includes `openReportCount` that drops after dismiss/action.
8. Driver JWT cannot list `/admin/reports` (`403`).
9. `tests/e2e/content-reports.spec.ts` (or extended admin-moderation e2e): authenticated reporter → open queue row → moderator hide via report action → feed exclusion.
10. `GETTING_STARTED.md` documents TLS nginx, `pg_dump` script path, and CI workflow path. `.github/workflows/ci.yml` exists and invokes typecheck + unit + frontend tests.
11. Block/mute/appeals/DMs are absent (no tables, routes, or UI).
