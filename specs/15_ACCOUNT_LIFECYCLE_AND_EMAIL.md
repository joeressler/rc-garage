# Milestone 15: Account Lifecycle, Email Verification & Driver Settings

## 1. Objective
Extend Milestone 03 authentication so a public community can recover accounts, prove email ownership, edit a public identity, and leave the platform. Registration currently issues a 7-day Bearer JWT with no verify, reset, profile write, or self-delete path. This milestone adds transactional email, hashed one-time tokens, age attestation, authenticated settings, and an unverified-driver gate on community writes. It does **not** migrate the SPA off `localStorage` Bearer JWTs (XSS trade-off documented below). It does **not** add OAuth, 2FA, or media uploads.

**Product framing:** this remains a setup-sheet community (garage, clipboard, feed, fork, QR). Account features exist so drivers can trust the pit, not so the product becomes a general social network.

**Depends on:** Milestones 03 (auth) and 13 (suspension + `ON DELETE` lineage). **Unblocks:** 16 (reports from verified drivers), 17 (writable bio/avatar), 19 (comment authorship).

---

## 2. Scope & Target Files
- `/backend/src/database/migrations/004_account_lifecycle.up.sql` (use the next sequential number after `003_vehicle_electronics` if that number is already taken)
- `/backend/src/database/migrations/004_account_lifecycle.down.sql`
- `/backend/src/database/schema.sql` (mirror new columns/tables)
- `/backend/src/contracts/auth.contract.ts`
- `/backend/src/modules/auth/auth.module.ts`
- `/backend/src/modules/auth/auth.controller.ts`
- `/backend/src/modules/auth/auth.service.ts`
- `/backend/src/modules/auth/email.service.ts` (new)
- `/backend/src/modules/auth/guards/email-verified.guard.ts` (new)
- `/backend/src/modules/auth/jwt.strategy.ts` (attach `emailVerified` onto `AuthenticatedUser`)
- `/backend/src/modules/setups/setups.controller.ts` (gate public create/update)
- `/backend/src/modules/setups/setups.service.ts` (reject `isPublic: true` when unverified)
- `/backend/src/modules/setups/likes.service.ts` / `setups.controller.ts` `POST :id/like` (verified)
- `/backend/src/modules/setups/fork.service.ts` / `setups.controller.ts` `POST :id/fork` (verified)
- `/backend/src/modules/vehicles/vehicles.controller.ts` (private fleet remains allowed unverified)
- `/.env.example` (`SMTP_*`, `SMTP_FROM`, `EMAIL_ENABLED`)
- `/frontend/src/api/auth.ts`
- `/frontend/src/stores/useAuthStore.ts`
- `/frontend/src/components/auth/AuthModal.tsx`
- `/frontend/src/components/auth/ForgotPasswordForm.tsx` (new)
- `/frontend/src/components/auth/ResetPasswordView.tsx` (new)
- `/frontend/src/components/auth/VerifyEmailView.tsx` (new)
- `/frontend/src/components/auth/AccountSettingsModal.tsx` (new)
- `/frontend/src/components/layout/DiagnosticTopBar.tsx` (Settings affordance + unverified banner trigger)
- `/frontend/src/components/layout/EmailVerificationBanner.tsx` (new)
- `/frontend/src/App.tsx` (routes `/auth/verify`, `/auth/reset`)
- `/frontend/src/views/SetupClipboardView.tsx` (surface 403 when publishing while unverified)
- `/backend/test/auth-lifecycle.spec.ts`
- `/tests/e2e/auth-lifecycle.spec.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Session model (explicit non-goal)
Keep the existing stateless JWT in Zustand persist key `rc-garage-auth` (`localStorage`). Logout remains client-side token clear.

**XSS trade-off (must appear as a comment on `useAuthStore` persist config and in this spec's implementation notes):** a stolen XSS payload can read the Bearer token for up to `JWT_EXPIRATION` (default `7d`). HttpOnly cookie + CSRF rotation is deferred; do not expand this milestone into a session rewrite.

### 3.2 Schema Extensions (Migration)
1. **`users` alterations:**
   - `email_verified_at TIMESTAMPTZ NULL`
   - `age_attested_at TIMESTAMPTZ NULL`
   - Index: `idx_users_email_verified` on `(email_verified_at)` WHERE `email_verified_at IS NULL` is optional; not required for v1 volume.
2. **`auth_one_time_tokens` table:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('email_verify', 'password_reset', 'email_change'))`
   - `token_hash VARCHAR(64) NOT NULL` (SHA-256 hex of the raw token; never store plaintext)
   - `expires_at TIMESTAMPTZ NOT NULL`
   - `consumed_at TIMESTAMPTZ NULL`
   - `payload JSONB NOT NULL DEFAULT '{}'::JSONB` (for `email_change`: `{ "nextEmail": "..." }`)
   - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - Unique: `(purpose, token_hash)`
   - Index: `idx_auth_tokens_user_purpose` on `(user_id, purpose)` WHERE `consumed_at IS NULL`
3. **Self-delete vs audit log:**
   - Today `moderation_audit_log.actor_user_id` is `ON DELETE RESTRICT`, which blocks `DELETE FROM users`.
   - Migration must alter that FK to `ON DELETE SET NULL` and make `actor_user_id` nullable.
   - Down migration may restore `RESTRICT` only if no null actors exist.
4. **Expiry constants (code, not SQL):**
   - Email verify / email-change tokens: 24 hours.
   - Password reset tokens: 1 hour.
   - Issuing a new token of the same `(user_id, purpose)` invalidates prior unconsumed rows (`consumed_at = now()` or delete).

### 3.3 Environment
Document in `/.env.example` (implementation updates the file; this milestone spec names the keys):

```
EMAIL_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@localhost
```

- When `EMAIL_ENABLED` is not `true`, `EmailService` must **not** open SMTP. It logs the action URL at `log.info` (never the raw token in production-shaped logs if `EMAIL_ENABLED=true`; in disabled mode the full URL may be logged for local agents).
- E2E reads tokens from `auth_one_time_tokens` via the test DB helper already used by garage workflow tests. **Never** return raw tokens in JSON when `EMAIL_ENABLED=true`.
- Test/dev convenience: if `EMAIL_ENABLED` is false, `POST /auth/verify-email` and `POST /auth/reset-password` still work against hashed tokens inserted by the API.

### 3.4 Password policy
Replace `UserRegistrationSchema` / change-password / reset-password password fields:

```typescript
export const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(100)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
```

Login still accepts any stored hash (including legacy 8-character passwords). Do not force a reset on existing accounts.

### 3.5 Registration age attestation
Minimum age is **13** (COPPA floor). Copy on the register form:

> I confirm I am 13 years of age or older.

```typescript
export const UserRegistrationSchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
  callsign: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  ageAttested: z.literal(true),
});
```

Reject `ageAttested !== true` with `400` field error on `ageAttested`. Persist `age_attested_at = now()`. Do **not** store date of birth.

Legal checkboxes for Terms/Privacy land in Milestone 16; 15 only requires the age literal.

### 3.6 Email verification
1. After successful `POST /auth/register`, insert an `email_verify` token and send/log `${APP_BASE_URL}/auth/verify?token=<raw>`.
2. Registration still returns JWT + profile so the driver can build a **private** garage immediately. `UserProfile.emailVerified` is `false` until consumed.
3. `POST /api/garage/auth/verify-email` body `{ token: string }`:
   - Hash token, find unconsumed non-expired `email_verify` row, set `users.email_verified_at`, consume token.
   - `200` `{ emailVerified: true }`. Invalid/expired: `400`.
4. `POST /api/garage/auth/resend-verification` (`JwtAuthGuard`): no-op success if already verified; otherwise rotate token and send again. Rate-limit is Milestone 16; 15 must still no-op duplicate sends within 60 seconds per user (return `200` with `{ sent: false, retryAfterSeconds: n }`).
5. SPA route `/auth/verify` reads `token` query, POSTs verify-email, then `checkSession()`.

### 3.7 Community write gate (`EmailVerifiedGuard`)
Unverified drivers **may**:
- Login, `GET /auth/me`, logout
- CRUD vehicles
- CRUD setups with `isPublic: false`
- `GET /feed`, inspect `/s/:slug`, download QR
- Edit profile bio/avatar URL (private-until-public identity; feed hides unverified authors' public sheets because they cannot publish yet)

Unverified drivers **must receive `403 Forbidden`** with envelope message `"Email verification required"` on:
- Creating a setup with `isPublic: true`
- Updating a setup such that `isPublic` becomes or remains `true` while unverified (force-private is allowed: `isPublic: false`)
- `POST /setups/:id/like`
- `POST /setups/:id/fork`

Apply `EmailVerifiedGuard` on those controller methods **and** enforce in the service so a missed decorator cannot publish. Suspended accounts remain rejected by existing 13 rules first.

Later milestones 16 (report) and 19 (comment) must reuse this guard.

### 3.8 Password reset and authenticated password change
```typescript
export const ForgotPasswordSchema = z.object({ email: z.string().email() });
export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,
});
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  nextPassword: PasswordSchema,
});
```

- `POST /auth/forgot-password`: always `200 { sent: true }` whether or not the email exists (do not leak accounts). If the user exists, rotate a `password_reset` token and send `${APP_BASE_URL}/auth/reset?token=<raw>`.
- `POST /auth/reset-password`: consume token, bcrypt the new password, consume all outstanding reset tokens for that user.
- `POST /auth/change-password` (`JwtAuthGuard`): verify `currentPassword`, reject if it matches `nextPassword`, then hash and store.

SPA: AuthModal login mode gets a "Forgot password" control opening `ForgotPasswordForm`. Route `/auth/reset` hosts `ResetPasswordView`.

### 3.9 Change email
```typescript
export const ChangeEmailSchema = z.object({
  password: z.string().min(1).max(100),
  nextEmail: z.string().email(),
});
```

`POST /auth/change-email` (`JwtAuthGuard`):
- Verify password.
- Reject if `nextEmail` is taken (`409`).
- Store pending address in token `payload`, send verify link to **nextEmail** only.
- On `POST /auth/verify-email` for `purpose = email_change`: set `users.email`, set `email_verified_at = now()`, do not leave the old address verified against a new mailbox.

### 3.10 Profile patch (no media)
`avatar_url` and `bio` already exist on `users` but have no writer.

```typescript
export const UpdateProfileSchema = z.object({
  bio: z.string().max(250).nullable().optional(),
  avatarUrl: z
    .string()
    .url()
    .max(2048)
    .refine((value) => /^https:\/\//i.test(value), 'avatarUrl must be https')
    .nullable()
    .optional(),
});
```

`PATCH /api/garage/auth/profile` (`JwtAuthGuard`) updates only provided keys. Callsign remains immutable in this milestone (uniqueness + QR attribution). No file upload, multipart, or data-URI avatars.

`GET /auth/me` and auth token user objects must include:

```typescript
emailVerified: boolean; // true iff email_verified_at IS NOT NULL
```

Frontend `UserProfile` / `SessionProfile` in `frontend/src/api/auth.ts` must stay in parity with the contract.

### 3.11 Account self-delete
`DELETE /api/garage/auth/me` (`JwtAuthGuard`) body:

```typescript
export const DeleteAccountSchema = z.object({
  password: z.string().min(1).max(100),
  confirmation: z.literal('DELETE'),
});
```

Transaction:
1. Verify password.
2. `DELETE FROM users WHERE id = $1` — vehicles, setups, likes cascade; fork pointers already `ON DELETE SET NULL`; audit `actor_user_id` becomes NULL after 3.2.
3. Return `200 { deleted: true }`.

SPA: settings modal requires typing `DELETE` plus password. On success, `logout()`.

Forbidden: deleting the last remaining `admin` (`409` with message `"Cannot delete the last administrator"`), matching Milestone 13 last-admin protection.

### 3.12 Email templates
Plain-text + simple HTML, Pit-Mat voice, no marketing list. Subjects:
- `Verify your RC Garage callsign`
- `Reset your RC Garage password`
- `Confirm your new RC Garage email`

Bodies include the callsign, a single HTTPS link, and a 1-hour/24-hour expiry sentence. No telemetry from other drivers.

### 3.13 Frontend settings
`DiagnosticTopBar`: authenticated drivers get a **Settings** control (Pit-Mat border button, not a new design system) that opens `AccountSettingsModal`:
- Bio textarea (250)
- Avatar URL input (https)
- Change password fields
- Change email fields
- Danger zone self-delete

`EmailVerificationBanner` renders under the top bar when `user.emailVerified === false`, with Resend. Publishing `isPublic` while unverified shows the existing clipboard error region with the API message (do not invent a second toast system).

### 3.14 Bootstrap admin
`BOOTSTRAP_ADMIN_EMAIL` promotion from Milestone 13 still runs on register/login. Bootstrap admins used in e2e may set `email_verified_at = now()` in the test harness after register, or call verify using the DB token, so community mutations in older e2e keep passing. Update existing e2e that publish/like/fork if they start receiving 403.

---

## 4. Verification & Acceptance Criteria
1. Register without `ageAttested: true` returns `400` and does not insert a user.
2. Register with a 9-character password returns `400`; a 10-character password with a letter and a number succeeds; `emailVerified` is `false`.
3. Unverified JWT can create a private setup and a vehicle; `isPublic: true`, like, and fork return `403` `"Email verification required"`.
4. Consuming a valid verify token sets `emailVerified: true` on subsequent `/auth/me`; the same token cannot be reused.
5. `POST /auth/forgot-password` for an unknown email returns the same `200 { sent: true }` as a known email.
6. Reset token expires after 1 hour (test with a pre-inserted expired row) and is single-use.
7. Change password rejects a wrong `currentPassword` with `401`; succeeds and allows login with the new password.
8. `PATCH /auth/profile` with `http://` avatar URL returns `400`; `https://` URL and a 250-char bio persist on `/auth/me`.
9. Self-delete with `confirmation: 'DELETE'` and password removes the user; subsequent login is `401`; fork children of that user's setups keep `forked_from_setup_id` null-safe (no FK violation). Last admin delete is `409`.
10. E2E `tests/e2e/auth-lifecycle.spec.ts` covers: register → gated public sheet → verify via DB token → publish succeeds → forgot/reset → settings bio → delete account.
11. Bearer JWT remains in `localStorage` under `rc-garage-auth`; no new cookie session is introduced.
