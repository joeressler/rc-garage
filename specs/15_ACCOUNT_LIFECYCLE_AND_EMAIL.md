# Milestone 15: Account Lifecycle & Driver Settings

## 1. Objective
Extend Milestone 03 authentication so a public community can attest age, use a stronger password policy, edit a public identity (bio / avatar URL), change password or email while logged in, and leave the platform. There is **no domain SMTP**: do **not** implement email verification, forgot/reset mail, one-time mail tokens, or an unverified-driver write gate. Bot friction at register is **Milestone 16 Google reCAPTCHA v2**. Forgot/reset password is **deferred** until a mailer exists — do not stub endpoints that pretend to send mail.

This milestone does **not** migrate the SPA off `localStorage` Bearer JWTs (XSS trade-off documented below). It does **not** add OAuth, 2FA, or media uploads.

**Product framing:** this remains a setup-sheet community (garage, clipboard, feed, fork, QR). Account features exist so drivers can trust the pit, not so the product becomes a general social network.

**Depends on:** Milestones 03 (auth) and 13 (suspension + last-admin rules + `ON DELETE` lineage). **Unblocks:** 16 (legal checkbox + reCAPTCHA on the same register form), 17 (writable bio/avatar).

---

## 2. Scope & Target Files
- `/backend/src/database/migrations/004_account_lifecycle.up.sql` (next sequential number after `003_vehicle_electronics`)
- `/backend/src/database/migrations/004_account_lifecycle.down.sql`
- `/backend/src/database/schema.sql`
- `/backend/src/contracts/auth.contract.ts`
- `/backend/src/modules/auth/auth.module.ts`
- `/backend/src/modules/auth/auth.controller.ts`
- `/backend/src/modules/auth/auth.service.ts`
- `/backend/src/modules/admin/admin.service.ts` (LEFT JOIN audit actors after SET NULL)
- `/backend/src/contracts/admin.contract.ts` (`actorUserId` nullable)
- `/frontend/src/api/auth.ts`
- `/frontend/src/api/admin.ts` (`actorUserId` nullable)
- `/frontend/src/stores/useAuthStore.ts`
- `/frontend/src/components/auth/AuthModal.tsx`
- `/frontend/src/components/auth/AccountSettingsModal.tsx` (new)
- `/frontend/src/components/layout/DiagnosticTopBar.tsx`
- `/backend/test/auth-lifecycle.spec.ts`
- `/tests/e2e/auth-lifecycle.spec.ts`
- `/frontend/src/components/auth/AuthModal.test.tsx`
- `/frontend/src/components/auth/AccountSettingsModal.test.tsx`

**Do not add:** `email.service.ts`, `email-verified.guard.ts`, verify/reset routes, SMTP env keys, nodemailer.

---

## 3. Detailed Technical Requirements

### 3.1 Session model (explicit non-goal)
Keep the existing stateless JWT in Zustand persist key `rc-garage-auth` (`localStorage`). Logout remains client-side token clear.

**XSS trade-off (must appear as a comment on `useAuthStore` persist config):** a stolen XSS payload can read the Bearer token for up to `JWT_EXPIRATION` (default `7d`). HttpOnly cookie + CSRF rotation is deferred; do not expand this milestone into a session rewrite.

### 3.2 Schema Extensions (Migration)
1. **`users` alterations:**
   - `age_attested_at TIMESTAMPTZ NULL` — set to `now()` on successful register
2. **Self-delete vs audit log:**
   - Today `moderation_audit_log.actor_user_id` is `ON DELETE RESTRICT`, which blocks `DELETE FROM users` for anyone who ever moderated.
   - Migration must alter that FK to `ON DELETE SET NULL` and make `actor_user_id` nullable.
   - Down migration may restore `RESTRICT` only if no null actors exist.
3. **Do not add** `email_verified_at` or `auth_one_time_tokens`.

Admin audit list must `LEFT JOIN users` and map a missing actor to callsign `deleted` so historical rows remain visible after a moderator self-deletes.

### 3.3 Password policy
Replace registration and change-password **next** password fields:

```typescript
export const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(100)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
```

Login still accepts any stored hash (including legacy 8-character passwords). Do not force a reset on existing accounts.

### 3.4 Registration age attestation
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

Legal checkboxes and reCAPTCHA land in Milestone 16; 15 only requires the age literal.

Non-suspended JWTs may create public setups, like, and fork without an extra verification step.

### 3.5 Authenticated password change
```typescript
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  nextPassword: PasswordSchema,
});
```

`POST /api/garage/auth/change-password` (`JwtAuthGuard`):
- Verify `currentPassword` (`401` if wrong).
- Reject if it matches `nextPassword` (`400`).
- Hash and store `nextPassword`. Return `200 { changed: true }`.

Forgot/reset-by-email is **out of this milestone**.

### 3.6 Change email (immediate)
```typescript
export const ChangeEmailSchema = z.object({
  password: z.string().min(1).max(100),
  nextEmail: z.string().email(),
});
```

`POST /api/garage/auth/change-email` (`JwtAuthGuard`):
- Verify password (`401` if wrong).
- Normalize `nextEmail` to lowercase.
- Reject if taken (`409`).
- Update `users.email` immediately (no confirm mail). Return updated `UserProfile`.

### 3.7 Profile patch (no media)
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

`PATCH /api/garage/auth/profile` (`JwtAuthGuard`) updates only provided keys. Callsign remains immutable. No file upload, multipart, or data-URI avatars. Return updated `UserProfile` (and `/auth/me` parity).

### 3.8 Account self-delete
`DELETE /api/garage/auth/me` (`JwtAuthGuard`) body:

```typescript
export const DeleteAccountSchema = z.object({
  password: z.string().min(1).max(100),
  confirmation: z.literal('DELETE'),
});
```

Transaction:
1. Verify password (`401` if wrong).
2. If the caller is an `admin` and they are the last remaining non-suspended admin, `409` with message `"Cannot delete the last administrator"`.
3. `DELETE FROM users WHERE id = $1` — vehicles, setups, likes cascade; fork pointers already `ON DELETE SET NULL`; audit `actor_user_id` becomes NULL after 3.2.
4. Return `200 { deleted: true }`.

SPA: settings modal requires typing `DELETE` plus password. On success, `logout()`.

### 3.9 Frontend settings
`DiagnosticTopBar`: authenticated drivers get a **Settings** control (Pit-Mat border button, not a new design system) that opens `AccountSettingsModal`:
- Bio textarea (250)
- Avatar URL input (https)
- Change password fields
- Change email fields
- Danger zone self-delete

No verification banner. No `/auth/verify` or `/auth/reset` routes.

`AuthModal` register mode: age checkbox (required), password `minLength={10}`, send `ageAttested: true`. No forgot-password control.

### 3.10 Bootstrap admin
`BOOTSTRAP_ADMIN_EMAIL` promotion from Milestone 13 still runs on register/login. Community mutations do not require a verify step.

---

## 4. Verification & Acceptance Criteria
1. Register without `ageAttested: true` returns `400` and does not insert a user.
2. Register with a 9-character password returns `400`; a 10-character password with a letter and a number succeeds and returns a JWT that can publish/like/fork immediately.
3. `POST /auth/change-password` rejects a wrong `currentPassword` with `401`; succeeds and allows login with the new password.
4. `POST /auth/change-email` with a taken address returns `409`; a unique address updates `/auth/me` immediately.
5. `PATCH /auth/profile` with `http://` avatar URL returns `400`; `https://` URL and a 250-char bio persist on `/auth/me`.
6. Self-delete with `confirmation: 'DELETE'` and password removes the user; subsequent login is `401`; fork children of that user's setups keep lineage null-safe (no FK violation). Last admin delete is `409`.
7. E2E `tests/e2e/auth-lifecycle.spec.ts` and `backend/test/auth-lifecycle.spec.ts` cover: register (age + password) → public sheet / like / fork without verify → change password → change email → settings bio → delete account.
8. Bearer JWT remains in `localStorage` under `rc-garage-auth`; no new cookie session is introduced.
9. No SMTP, verify-email, forgot-password, or `EmailVerifiedGuard` code exists.
