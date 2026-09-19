# Milestone 19: Setup Sheet Comments

## 1. Objective
Add a flat, moderated comment thread on **public** setup sheets so drivers can discuss telemetry without turning RC Garage into a chat product. Comments live on inspect overlays, not a global inbox. Nested replies, mentions, reactions, and DMs are out of scope.

**Product framing:** comments annotate a setup sheet (like a GitHub issue on a forkable spec), not a social feed post.

**Depends on:**
- Milestone 15 — `EmailVerifiedGuard` for create
- Milestone 16 — `content_reports.target_type = 'comment'` CHECK already exists; wire it
- Milestone 13 — moderator hide + `moderation_audit_log`

**Unblocks:** Milestone 20 comment notifications.

---

## 2. Scope & Target Files
- `/backend/src/database/migrations/006_setup_comments.up.sql` (next sequential after 16)
- `/backend/src/database/migrations/006_setup_comments.down.sql`
- `/backend/src/database/schema.sql`
- `/backend/src/contracts/comment.contract.ts` (new)
- `/backend/src/contracts/report.contract.ts` (allow `targetType: 'comment'` on create)
- `/backend/src/modules/comments/comments.module.ts` (new)
- `/backend/src/modules/comments/comments.controller.ts` (new)
- `/backend/src/modules/comments/comments.service.ts` (new)
- `/backend/src/modules/reports/reports.service.ts` (resolve comment targets; hide comment action)
- `/backend/src/modules/admin/admin.controller.ts` / `admin.service.ts` (optional comment hide endpoint **or** reuse report `hideComment`)
- `/backend/src/contracts/admin.contract.ts`
- `/frontend/src/api/comments.ts` (new)
- `/frontend/src/components/feed/SetupCommentsPanel.tsx` (new)
- `/frontend/src/components/feed/SetupInspectOverlay.tsx`
- `/frontend/src/components/feed/ReportSetupModal.tsx` (report comment)
- `/frontend/src/components/admin/ReportQueuePanel.tsx` (comment target summary)
- `/backend/test/comments.e2e.ts`
- `/tests/e2e/setup-comments.spec.ts`
- `/frontend/src/components/feed/SetupCommentsPanel.test.tsx`

Do not add WebSockets. List + POST is enough; the overlay refetch after submit.

---

## 3. Detailed Technical Requirements

### 3.1 Schema
```sql
CREATE TABLE setup_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_id UUID NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body VARCHAR(2000) NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_at TIMESTAMPTZ,
  hidden_reason VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_setup_comments_setup_created
  ON setup_comments (setup_id, created_at ASC)
  WHERE is_hidden = FALSE;
```

No `parent_id`. Flat chronological list. `updated_at` exists for future edits; **v1 has no edit API** (author delete only).

### 3.2 Contracts
```typescript
export const CommentBodySchema = z.string().trim().min(1).max(2000);

export const CreateCommentSchema = z.object({
  body: CommentBodySchema,
});

export const ListCommentsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface SetupComment {
  id: string;
  setupId: string;
  body: string;
  createdAt: string;
  author: { callsign: string; avatarUrl: string | null };
  isAuthor: boolean; // true when JWT subject is author
}
```

Public list **omits** `is_hidden = TRUE` rows. Authors do not see their own hidden comments in public inspect (operators use admin/report queue).

### 3.3 HTTP API
Prefix `/api/garage`.

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/setups/:id/comments` | Optional JWT | Oldest-first page for inspect; `404` if setup missing or not publicly inspectable (`is_public` and not `is_hidden`, unless caller owns the private sheet — **private sheets: comments disabled**, always `403` `"Comments are only available on public sheets"`) |
| `POST` | `/setups/:id/comments` | JWT + EmailVerified + not suspended | Create; `201` comment |
| `DELETE` | `/comments/:id` | JWT | Author may hard-delete own comment (`204`/`200 { deleted: true }`). Moderators/admins may hide instead (3.4) |
| `PATCH` | `/admin/comments/:id/visibility` | moderator/admin | `{ hide: true, reason }` sets `is_hidden` |

Create rules:
- Setup must be `is_public = TRUE` and `is_hidden = FALSE`.
- Empty/whitespace body `400`.
- Per-user rate: max **one comment per 15 seconds** per setup (`429` if violated). Nest throttler IP limit from 16 still applies globally.
- Strip ASCII control characters; do not implement Markdown rendering (plain text, preserve newlines in UI with CSS `whitespace-pre-wrap`).
- No @mention parsing.

### 3.4 Moderation and reports
Milestone 16 reserved `target_type = 'comment'`. Extend `CreateReportSchema.targetType` to `'setup' | 'user' | 'comment'`.
- Comment must exist and not already be hidden; else `404`.
- `ResolveReportSchema` adds optional `hideComment: z.boolean().optional()`. When true, set `setup_comments.is_hidden`, write `moderation_audit_log` actions `comment.hide` and `report.resolve`.
- Public inspect never returns hidden comments.
- Author `DELETE` is a true delete (cascade report rows via `target_id` left dangling is OK; resolve query should left-join and show “deleted comment”). Prefer `ON DELETE` nothing on reports (no FK to comments). Queue can display `target missing`.

### 3.5 Inspect overlay UI
`SetupCommentsPanel` at the bottom of `SetupInspectOverlay`:
- Heading `Pit Notes` (or `Sheet Comments`) in Barlow Condensed
- List: `DriverAvatar` + `@callsign` (link to `/u/:callsign` from 17) + timestamp + body
- Author sees a Delete control on own rows
- Composer: textarea 2000, submit **Post note**; guests hit `onRequestAuth`; unverified see 15's verification message
- Load more if paginated
- Report control per comment (reuses report modal with `targetType: 'comment'`)

Clipboard editor (`SetupClipboardView`) does **not** host comments (inspect overlay is the community surface).

### 3.6 Counts (optional)
Do **not** denormalize `comment_count` on `setups` unless the implementer needs it for feed cards. v1: no comment count on `FeedItem` (avoids feed invalidation). Overlay can show `comments.length` / `hasMore`.

---

## 4. Verification & Acceptance Criteria
1. `POST /setups/:id/comments` without JWT is `401`; unverified JWT is `403` `"Email verification required"`.
2. Commenting on a private or hidden setup is `403`/`404` and inserts no row.
3. Public sheet: verified driver posts a 1–2000 character body; `GET` list includes it in chronological order with author callsign.
4. Body of 2001 characters is `400`. A second post within 15 seconds from the same user on the same sheet is `429`.
5. Author delete removes the row from subsequent public GET.
6. Moderator hide removes the row from public GET; report `targetType: 'comment'` + `hideComment` writes audit `comment.hide`.
7. Nested `parentId` is rejected if sent (unknown keys stripped by Zod; no thread UI).
8. Frontend overlay test: composer hidden for guests; visible for verified session; list renders bodies.
9. `tests/e2e/setup-comments.spec.ts`: verify → comment public sheet → second driver lists it → moderator hide → GET omits it; hidden setup cannot be commented.
10. No DM, follow, mention, or reply-thread tables.
