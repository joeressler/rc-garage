# Milestone 13: Admin Console & Community Moderation Control Plane

## 1. Objective
Deliver a role-gated admin console so platform operators can moderate the website: manage driver accounts (suspend/ban/reinstate), force-unpublish or remove abusive setup sheets, review community content, and retain an immutable audit trail of every moderation action.

---

## 2. Scope & Target Files
- `/backend/src/database/migrations/*_admin_moderation.sql`
- `/backend/src/modules/auth/guards/roles.guard.ts`
- `/backend/src/modules/auth/decorators/roles.decorator.ts`
- `/backend/src/modules/admin/admin.module.ts`
- `/backend/src/modules/admin/admin.controller.ts`
- `/backend/src/modules/admin/admin.service.ts`
- `/backend/src/modules/admin/dto/admin-query.dto.ts`
- `/backend/src/modules/admin/dto/moderate-user.dto.ts`
- `/backend/src/modules/admin/dto/moderate-setup.dto.ts`
- `/backend/src/contracts/admin.contract.ts`
- `/frontend/src/stores/useAdminStore.ts`
- `/frontend/src/views/AdminConsoleWorkbench.tsx`
- `/frontend/src/components/admin/AdminOverviewPanel.tsx`
- `/frontend/src/components/admin/UserModerationTable.tsx`
- `/frontend/src/components/admin/SetupModerationTable.tsx`
- `/frontend/src/components/admin/ModerationAuditLogPanel.tsx`
- `/frontend/src/components/admin/ModerationActionModal.tsx`
- `/frontend/src/components/layout/ToolboxDrawerNavigation.tsx` (Admin drawer tab)
- `/tests/e2e/admin-moderation.spec.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Schema Extensions (Migration)
Extend the relational model with role, suspension, content-hiding, and audit columns/tables:

1. **`users` Table Alterations:**
   - `role VARCHAR(20) NOT NULL DEFAULT 'driver'` with `CHECK (role IN ('driver', 'moderator', 'admin'))`
   - `is_suspended BOOLEAN NOT NULL DEFAULT FALSE`
   - `suspended_at TIMESTAMPTZ NULL`
   - `suspension_reason VARCHAR(500) NULL`
   - Index: `idx_users_role` on `role`
   - Index: `idx_users_suspended` on `is_suspended` WHERE `is_suspended = TRUE`

2. **`setups` Table Alterations:**
   - `is_hidden BOOLEAN NOT NULL DEFAULT FALSE` (moderator force-hide; excluded from public feed and `/s/:slug` when true)
   - `hidden_at TIMESTAMPTZ NULL`
   - `hidden_reason VARCHAR(500) NULL`
   - Replace/extend feed index to exclude hidden rows:
     - `idx_setups_feed_composite` on `(is_public, created_at DESC) WHERE is_public = TRUE AND is_hidden = FALSE`

3. **`moderation_audit_log` Table:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
   - `action VARCHAR(40) NOT NULL` (e.g. `user.suspend`, `user.reinstate`, `user.role_change`, `setup.hide`, `setup.unhide`, `setup.delete`)
   - `target_type VARCHAR(20) NOT NULL` (`user` | `setup`)
   - `target_id UUID NOT NULL`
   - `reason VARCHAR(500) NULL`
   - `metadata JSONB NOT NULL DEFAULT '{}'::JSONB`
   - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - Indexes: `idx_moderation_audit_created` on `(created_at DESC)`, `idx_moderation_audit_target` on `(target_type, target_id)`

4. **Bootstrap Admin:**
   - Document env `BOOTSTRAP_ADMIN_EMAIL` (optional). On first successful login/register matching that email, promote `role = 'admin'` idempotently if no admin exists yet.
   - Never allow the last remaining `admin` account to be demoted or suspended.

### 3.2 Authorization Contracts
1. **JWT Payload Extension:**
   ```typescript
   { sub: user.id, callsign: user.callsign, role: user.role }
   ```
2. **`Roles` decorator + `RolesGuard`:**
   - Compose with `JwtAuthGuard`.
   - Allow when `request.user.role` is in the declared set.
   - Treat `admin` as a superset of `moderator` privileges for all `/admin/*` routes.
3. **Suspended Account Gate:**
   - Auth login and JWT strategy reject suspended users with `403 Forbidden` and message `"Account suspended"`.
   - Suspended drivers cannot create/update setups, fork, or like.

### 3.3 Admin API Surface (`/api/garage/admin/*`)
All routes require `JwtAuthGuard` + `RolesGuard(['admin', 'moderator'])` unless noted.

| Method | Subpath | Roles | Body / Query | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/overview` | admin, moderator | none | `{ userCount, setupCount, publicSetupCount, hiddenSetupCount, suspendedUserCount, likes24h }` | Console KPI strip for operators. |
| `GET` | `/admin/users` | admin, moderator | `AdminUserQuerySchema` | Paginated user rows | Search/filter drivers by callsign, email, role, suspension. |
| `PATCH` | `/admin/users/:id/suspension` | admin, moderator | `ModerateUserSuspensionSchema` | Updated user summary | Suspend or reinstate a driver with required reason on suspend. |
| `PATCH` | `/admin/users/:id/role` | **admin only** | `{ role: 'driver' \| 'moderator' \| 'admin' }` | Updated user summary | Promote/demote staff; forbidden against self or last admin. |
| `GET` | `/admin/setups` | admin, moderator | `AdminSetupQuerySchema` | Paginated setups | Includes private + hidden setups for moderation review. |
| `PATCH` | `/admin/setups/:id/visibility` | admin, moderator | `ModerateSetupVisibilitySchema` | Updated setup summary | Force-hide or restore a setup (`is_hidden`). |
| `DELETE` | `/admin/setups/:id` | **admin only** | `{ reason: string }` | `{ deleted: true, id }` | Hard-delete abusive setup; write audit row; preserve fork lineage via existing `ON DELETE SET NULL`. |
| `GET` | `/admin/audit-log` | admin, moderator | cursor + limit | Paginated audit entries | Chronological moderation history. |

#### Zod Contracts (`backend/src/contracts/admin.contract.ts`)
```typescript
export const AdminUserQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().min(1).max(80).optional(), // matches callsign OR email (ILIKE)
  role: z.enum(['driver', 'moderator', 'admin']).optional(),
  suspended: z.coerce.boolean().optional(),
});

export const ModerateUserSuspensionSchema = z.object({
  suspend: z.boolean(),
  reason: z.string().min(3).max(500).optional(),
}).superRefine((val, ctx) => {
  if (val.suspend && !val.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reason is required when suspending', path: ['reason'] });
  }
});

export const ModerateSetupVisibilitySchema = z.object({
  hide: z.boolean(),
  reason: z.string().min(3).max(500).optional(),
}).superRefine((val, ctx) => {
  if (val.hide && !val.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reason is required when hiding', path: ['reason'] });
  }
});

export const AdminSetupQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().min(1).max(100).optional(),
  hidden: z.coerce.boolean().optional(),
  isPublic: z.coerce.boolean().optional(),
  authorCallsign: z.string().optional(),
});
```

#### Service Rules
1. Every successful mutating admin action inserts one `moderation_audit_log` row in the same DB transaction.
2. Hiding a setup sets `is_hidden = TRUE`, `hidden_at = now()`, `hidden_reason = reason`. Unhide clears those fields.
3. Public feed (`GET /feed`) and public QR inspection (`/s/:slug`) must exclude `is_hidden = TRUE` setups.
4. Non-admin callers receiving `/admin/*` get `403 Forbidden` in the standard error envelope.

### 3.4 Frontend Admin Console (`AdminConsoleWorkbench`)
1. **Route & Nav:**
   - SPA route `/admin` guarded client-side: render only when `user.role` is `admin` or `moderator`; otherwise redirect to Fleet Garage.
   - Add Toolbox Drawer tab **"Scrutineering Desk"** (Admin) visible only to elevated roles.
2. **`useAdminStore`:**
   - Holds overview KPIs, user page, setup page, audit page, loading/error flags, and actions mirroring the admin API.
3. **Workbench Panels (one primary job each):**
   - **Overview:** KPI readouts (users, public setups, hidden setups, suspended accounts).
   - **Drivers table:** search, suspend/reinstate with reason modal; admins additionally change roles.
   - **Setups table:** search, force-hide/restore, admin-only delete with reason modal.
   - **Audit log:** newest-first list of actor callsign, action, target, reason, timestamp.
4. **Visual language:** Reuse Pit-Mat tokens (hazard orange for destructive actions, nitromethane for pending review, neon-radio for reinstated/visible). No separate design system.

### 3.5 Auth Profile Contract Updates
Extend `UserProfile` (backend responses + `useAuthStore`) with:
```typescript
role: 'driver' | 'moderator' | 'admin';
isSuspended: boolean;
```
`GET /auth/me` returns these fields so the SPA can gate the Scrutineering Desk without a separate privilege probe.

---

## 4. Verification & Acceptance Criteria
1. A `driver` JWT calling any `/admin/*` endpoint receives `403 Forbidden`.
2. A `moderator` can suspend a driver and hide a public setup; the setup disappears from `/feed` and `/s/:slug` while remaining visible in `/admin/setups?hidden=true`.
3. Suspended drivers cannot log in; existing sessions fail subsequent authenticated mutations with `403`.
4. Only `admin` can change roles or hard-delete setups; demoting/suspending the last admin is rejected.
5. Every mutation writes a corresponding `moderation_audit_log` row queryable via `/admin/audit-log`.
6. The Scrutineering Desk UI loads for elevated roles, supports search + moderation actions with required reasons, and stays hidden for ordinary drivers.
7. E2E test `admin-moderation.spec.ts` covers: promote/bootstrap admin → hide abusive setup → verify feed exclusion → suspend author → verify login blocked → reinstate → verify audit trail entries.
