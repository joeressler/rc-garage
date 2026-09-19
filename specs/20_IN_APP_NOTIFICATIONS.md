# Milestone 20: In-App Notifications

## 1. Objective
Notify a driver when the community interacts with their public setup sheet: like, fork, comment, and report-queue outcomes. Delivery is an in-app Pit-Mat bell on the diagnostic top bar, polled over REST. No WebSockets, no email digests, no push, no follow graph.

**Product framing:** notifications are garage telemetry about **your sheets**, not a social inbox.

**Depends on:** Milestone 08 likes, 06 forks, 15 identity, 16 `report.resolve` (for `report_outcome`), 19 comments.

---

## 2. Scope & Target Files
- `/backend/src/database/migrations/007_notifications.up.sql` (next sequential after 19)
- `/backend/src/database/migrations/007_notifications.down.sql`
- `/backend/src/database/schema.sql`
- `/backend/src/contracts/notification.contract.ts` (new)
- `/backend/src/modules/notifications/notifications.module.ts` (new)
- `/backend/src/modules/notifications/notifications.controller.ts` (new)
- `/backend/src/modules/notifications/notifications.service.ts` (new; insert + list + mark read)
- `/backend/src/modules/setups/likes.service.ts` (fan-out on like, not unlike)
- `/backend/src/modules/setups/fork.service.ts` (fan-out on successful fork)
- `/backend/src/modules/comments/comments.service.ts` (fan-out on create)
- `/backend/src/modules/admin/admin.service.ts` or reports resolver (fan-out `report_outcome` to reporter)
- `/frontend/src/api/notifications.ts` (new)
- `/frontend/src/stores/useNotificationStore.ts` (new)
- `/frontend/src/components/layout/NotificationBell.tsx` (new)
- `/frontend/src/components/layout/DiagnosticTopBar.tsx`
- `/frontend/src/components/layout/NotificationBell.test.tsx`
- `/frontend/src/stores/useNotificationStore.test.ts`
- `/backend/test/notifications.e2e.ts`
- `/tests/e2e/notifications.spec.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Schema
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(32) NOT NULL
    CHECK (type IN ('like', 'fork', 'comment', 'report_outcome')),
  setup_id UUID REFERENCES setups(id) ON DELETE SET NULL,
  comment_id UUID REFERENCES setup_comments(id) ON DELETE SET NULL,
  report_id UUID REFERENCES content_reports(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_notifications_recipient_created
  ON notifications (recipient_user_id, created_at DESC);
CREATE INDEX idx_notifications_recipient_unread
  ON notifications (recipient_user_id)
  WHERE read_at IS NULL;
```

If `content_reports` / `setup_comments` migrations use different numbers, FK names follow those tables. Implementer must not create notifications tables before 16/19 exist.

### 3.2 Fan-out rules
Insert in the **same transaction** as the triggering mutation when practical (like/fork/comment). Report outcome can be the same transaction as `PATCH /admin/reports/:id`.

| Event | Recipient | Actor | Skip when |
| :--- | :--- | :--- | :--- |
| Like added (`liked: true`) | Setup author | Liker | Actor is author; setup `is_public = FALSE`; unlike (`liked: false`) **does not** insert or delete prior like notifications |
| Fork created | Parent setup author | Forker | Actor is author (forking your own public sheet) |
| Comment created | Setup author | Commenter | Actor is author |
| Report resolved (`actioned` or `dismissed`) | Original reporter | Operator (`resolved_by`) | none (reporter should learn the outcome) |

Never notify for private sheets (likes on private sheets are already owner-only in likes.service; still guard).

Do not collapse/dedupe likes in v1 (ten likes = ten rows). Document that a later milestone may coalesce.

### 3.3 HTTP API
All routes `JwtAuthGuard`.

```typescript
export const NotificationListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().optional(),
});

export interface NotificationItem {
  id: string;
  type: 'like' | 'fork' | 'comment' | 'report_outcome';
  createdAt: string;
  readAt: string | null;
  actorCallsign: string | null;
  setupTitle: string | null;
  setupId: string | null;
  qrSlug: string | null;
  bodyPreview: string | null; // comment excerpt or report status
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
}
```

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/notifications` | Newest first, keyset on id/created_at; include `unreadCount` for the recipient |
| `POST` | `/notifications/read` | Body `{ ids?: uuid[] }` — if `ids` omitted, mark **all** unread as read |
| `GET` | `/notifications/unread-count` | `{ unreadCount }` for cheap poll |

Envelope remains standard. Recipients only see their rows (no admin dump in v1).

### 3.4 Frontend bell
`DiagnosticTopBar` (authenticated only): `NotificationBell`.
- Poll `GET /notifications/unread-count` every **60s** while the tab is visible (`document.visibilityState`), and on navigation/focus. No WebSocket.
- Unread badge: neon-radio count, cap display at `99+`.
- Panel: last page of notifications; click like/fork/comment rows navigates to `/feed?inspect={setupId}` (or `/s/{slug}` in Vite). Report outcome rows stay in the panel with status text; no requirement to open admin.
- Mark a row read on click; “Mark all read” control.
- Empty: `No pit signals`.
- Pit-Mat styling only (pit-steel panel, mono timestamps).

`useNotificationStore`: items, unreadCount, fetch, markRead, poll handle. Reset on logout.

### 3.5 Email
Do **not** send SMTP for notifications even if Milestone 15 `EMAIL_ENABLED=true`. In-app only. A digest is a future deferred item.

---

## 4. Verification & Acceptance Criteria
1. Driver A publishes a public sheet; driver B likes it → A’s `GET /notifications` contains `type: 'like'` with B’s callsign; `unreadCount >= 1`.
2. B unlikes: no additional row; existing like notification remains.
3. B forks A’s sheet → A receives `type: 'fork'`. A liking or commenting on A’s own sheet inserts **zero** rows.
4. B comments → A receives `type: 'comment'` with a body preview truncated for the card.
5. Moderator dismisses B’s report → B receives `type: 'report_outcome'`.
6. Private sheet activity never fans out.
7. `POST /notifications/read` without ids zeroes `unreadCount`.
8. Driver JWT cannot read another user’s notifications (query always filtered by `sub`).
9. Frontend test: badge reflects unreadCount; poll store does not use WebSocket APIs.
10. `tests/e2e/notifications.spec.ts`: register/verify two drivers → like → list notification → mark read → unreadCount 0.
11. No DMs, follows, email sends, or Socket.IO modules.
