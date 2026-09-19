# Milestone 17: Driver Profiles & Community Quality-of-Life

## 1. Objective
Finish identity and discovery surfaces that the schema and feed API already imply but the SPA does not expose: a public `/u/:callsign` garage, clickable authors, rendered avatars, clipboard tags, tag/location feed filters, one-tap copy of `/s/:slug`, and a guest landing on the community feed. Remove leftover placeholder views. No comments, notifications, follows, or photo uploads.

**Product framing:** a driver profile is a public setup-sheet index (callsign, bio, avatar URL, public sheets), not a social wall.

**Depends on:** Milestone 08/12 (feed), 15 (`PATCH /auth/profile` for bio/avatar). **Does not depend on** 16 except that legal footer links may already exist.

---

## 2. Scope & Target Files
- `/backend/src/contracts/profile.contract.ts` (new)
- `/backend/src/modules/profiles/profiles.module.ts` (new)
- `/backend/src/modules/profiles/profiles.controller.ts` (new)
- `/backend/src/modules/profiles/profiles.service.ts` (new)
- `/backend/src/app.module.ts` (register ProfilesModule)
- `/backend/src/contracts/feed.contract.ts` (no breaking change; `avatarUrl` already present)
- `/frontend/src/api/profiles.ts` (new)
- `/frontend/src/views/PublicDriverProfileView.tsx` (new)
- `/frontend/src/views/PublicDriverProfileView.test.tsx`
- `/frontend/src/App.tsx` (`/u/:callsign`, `/` → `/feed`)
- `/frontend/src/components/feed/SetupSheetCard.tsx`
- `/frontend/src/components/feed/SetupInspectOverlay.tsx`
- `/frontend/src/components/feed/DriverAvatar.tsx` (new)
- `/frontend/src/components/feed/CopyPublicLinkButton.tsx` (new)
- `/frontend/src/components/feed/FeedFilterDrawer.tsx`
- `/frontend/src/views/CommunityFeedWorkbench.tsx`
- `/frontend/src/stores/useSetupStore.ts` (stop forcing `tags: []` on create/save when meta has tags)
- `/frontend/src/components/setup/ClipboardTagsField.tsx` (new)
- `/frontend/src/components/setup/ClipboardHeaderClamp.tsx` and/or `ClipboardActionBar.tsx`
- `/frontend/src/components/layout/ToolboxDrawerNavigation.tsx` (profile-unrelated; ensure `/u/` does not look like a toolbox tab)
- `/frontend/src/views/FeedPlaceholderView.tsx` (delete)
- `/frontend/src/views/ClipboardPlaceholderView.tsx` (delete)
- `/frontend/src/views/StickersPlaceholderView.tsx` (delete)
- `/frontend/src/views/PublicInspectionView.tsx` (**keep file** but do not route it; comment that `/s/:slug` is owned by `CommunityFeedWorkbench` overlay)
- `/frontend/src/views/CommunityFeedWorkbench.test.tsx`
- `/frontend/src/components/feed/SetupSheetCard.test.tsx` (create if missing)
- `/frontend/src/components/setup/ClipboardTagsField.test.tsx`
- `/backend/test/profiles.e2e.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Public profile API
`GET /api/garage/profiles/:callsign` — public, optional JWT unused except future likes annotation on listed sheets.

Callsign param: same regex as users (`^[a-zA-Z0-9_-]+$`, 3–30). Lookup is **case-insensitive**; response `callsign` is the stored canonical casing.

```typescript
export interface PublicDriverProfile {
  callsign: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  publicSetupCount: number;
  items: FeedItem[]; // reuse FeedItem from feed.contract.ts
  nextCursor: string | null;
  hasMore: boolean;
}
```

Query: `cursor` UUID, `limit` 1–50 default 20. Sheets: `is_public = TRUE AND is_hidden = FALSE AND user_id = profile`. Sort `created_at DESC` (same keyset idea as feed).

**Must not leak:** email, role, suspension reason, private setups, archived-only vehicles, electronics of private bays, other drivers' sheets.

`404` when callsign does not exist **or** the user is suspended (treat as not found to avoid confirming banned handles).

### 3.2 SPA profile view
Route `/u/:callsign` → `PublicDriverProfileView` inside `PitMatAppLayout`.
- Header: `DriverAvatar`, `@callsign`, bio (or an empty-state line “No bio logged”), public setup count.
- Grid of existing `SetupSheetCard` (inspect + like + fork behaviors unchanged).
- Load more when `hasMore`.
- Own profile is the same public view (settings remain Milestone 15 modal, not this page).

Clickable `@callsign` on `SetupSheetCard` and inspect overlay author line: `react-router` `Link` to `/u/${callsign}`. Do not navigate when clicking like/fork.

### 3.3 Avatars
`DriverAvatar` props: `callsign`, `avatarUrl: string | null`, `size: 'sm' | 'md'`.
- If `avatarUrl` is an `https:` URL, render `<img alt="" />` (decorative next to visible callsign; `alt` empty). On error, fall back to initials.
- Else 1–2 letter initials from callsign on a pit-steel disc with neon-radio border.

Use it on feed cards, inspect overlay, and public profile header. Admin tables may adopt it but are not required.

### 3.4 Tags (already in DB and Zod)
Backend `CreateSetupSchema` already allows `tags: z.array(z.string().min(2).max(30)).max(10)`. Frontend store currently initializes and often persists `tags: []`.

`ClipboardTagsField`:
- Bound to `useSetupStore` `meta.tags` via `updateMeta`.
- Add tag on Enter/comma; strip `#`; lowercase normalize; reject duplicates; max 10; each 2–30 chars matching the contract.
- Save path must send `meta.tags` (fix any branch that hardcodes `[]` on create).

`FeedFilterDrawer` adds:
- Tag text input mapped to existing `FeedQuerySchema.tag` (`tags @>`).
- Location text input mapped to existing `locationTag`.
- Reset clears them. `hasActiveFilters` includes tag/location.

Feed cards may show up to three tags if `FeedItem` is extended; **optional**. If extended, add `tags: string[]` to `FeedItem` and the SELECT in `feed.service.ts` without breaking existing tests.

### 3.5 Copy public URL
`CopyPublicLinkButton`: builds `${window.location.origin}/s/${qrSlug}` (do not hardcode `APP_BASE_URL` in the browser; origin is the public host). `navigator.clipboard.writeText`. Button text toggles to “Copied” for 2s. Place:
- `SetupInspectOverlay` header/actions
- `ClipboardActionBar` when `activeSetup.qrSlug` exists

No `navigator.share` requirement (optional progressive enhancement allowed).

### 3.6 Guest landing
`App.tsx`: `<Route path="/" element={<Navigate to="/feed" replace />} />` (today it redirects to `/garage`).

Garage empty-rack onboarding remains on `/garage`. Toolbox drawer labels unchanged.

### 3.7 Dead views
Delete `FeedPlaceholderView.tsx`, `ClipboardPlaceholderView.tsx`, `StickersPlaceholderView.tsx` and any imports. `PublicInspectionView.tsx` stays in tree as unused legacy; add a file-level comment that routing lives on `CommunityFeedWorkbench` + `SetupInspectOverlay`. Do not reintroduce `/s/:slug` as a standalone page.

---

## 4. Verification & Acceptance Criteria
1. `GET /profiles/UnknownCallsign` returns `404`. A suspended driver's callsign returns `404`.
2. Public profile lists only that driver's public, non-hidden sheets; a private sheet never appears even for the owner's unauthenticated request (owner uses clipboard for private work).
3. Feed card `@callsign` is a link to `/u/{callsign}`; frontend test clicks through (MemoryRouter).
4. When `avatarUrl` is non-null https, the card renders an `img`; when null, initials render.
5. Saving a clipboard sheet with tags `['moab', 'comp']` persists them; `GET /feed?tag=moab` returns that sheet. Location filter uses `locationTag` query.
6. Copy control writes `/s/{slug}` to clipboard (mock `navigator.clipboard` in unit tests).
7. Unauthenticated visit to `/` shows the community feed workbench, not the empty garage rack.
8. Placeholder view files listed in §2 are gone and `tsc` has no lingering imports.
9. `backend/test/profiles.e2e.ts` covers public list, hidden exclusion, case-insensitive callsign, 404 suspended.
10. No comment, notification, follow, or image-upload endpoints are added.
