# Milestone 08: Community Setup Discovery Feed & Social Validation

## 1. Objective
Implement the community discovery feed API in NestJS, supporting cursor-based pagination, multi-vector filtering (surface type, vehicle model, class, location tags), and star/like endorsement toggles.

---

## 2. Scope & Target Files
- `/backend/src/modules/feed/feed.module.ts`
- `/backend/src/modules/feed/feed.controller.ts`
- `/backend/src/modules/feed/feed.service.ts`
- `/backend/src/modules/feed/dto/feed-query.dto.ts`
- `/backend/src/modules/setups/likes.service.ts`
- `/backend/src/contracts/feed.contract.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Feed Query DTO & Filters
```typescript
import { z } from 'zod';
import { SurfaceTypeEnum, VehicleClassEnum } from '../contracts/vehicle.contract';

export const FeedQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  model: z.string().optional(),
  make: z.string().optional(),
  vehicleClass: VehicleClassEnum.optional(),
  surfaceType: SurfaceTypeEnum.optional(),
  locationTag: z.string().optional(),
  tag: z.string().optional(),
  sortBy: z.enum(['newest', 'most_forked', 'most_liked']).default('newest'),
});

export type FeedQueryDto = z.infer<typeof FeedQuerySchema>;
```

### 3.2 Feed Discovery API Route (`GET /api/garage/feed`)
- Public endpoint (no auth required, but accepts optional Bearer JWT to annotate `isLikedByCaller`).
- Query parameters parsed and validated against `FeedQuerySchema`.
- SQL Query Construction:
  - Filters strictly by `is_public = TRUE`.
  - Joins with `vehicles` to filter by vehicle model/make/class.
  - Joins with `users` to attach author callsign and avatar.
  - Applies tag filter: `tags @> ARRAY[$tag]`.
  - Cursor pagination using keyset on `(created_at, id)` to prevent pagination drift.
  - Returns:
    ```json
    {
      "items": [
        {
          "id": "uuid",
          "title": "Rubicon Low-CoG Comp Spec",
          "author": { "callsign": "CrawlerKing", "avatarUrl": "..." },
          "vehicle": { "make": "Vanquish", "model": "VS4-10 Phoenix", "class": "crawler_scale" },
          "calculatedFdr": 10.80,
          "frontBiasPercentage": 59.2,
          "surfaceType": "granite_rock",
          "forkCount": 14,
          "likeCount": 38,
          "isLikedByCaller": false,
          "qrSlug": "v9k2pq1x8m",
          "createdAt": "2026-09-15T10:00:00Z"
        }
      ],
      "nextCursor": "uuid-or-null",
      "hasMore": true
    }
    ```

### 3.3 Star / Like Endorsement Route (`POST /api/garage/setups/:id/like`)
- Protected: `JwtAuthGuard`.
- Param: `id` (UUID).
- Action (Atomic Transaction):
  - Check if row exists in `setup_likes` for `(user_id, setup_id)`.
  - If exists:
    - `DELETE FROM setup_likes WHERE user_id = $uid AND setup_id = $sid;`
    - `UPDATE setups SET like_count = GREATEST(like_count - 1, 0) WHERE id = $sid;`
    - Return `{ liked: false, likeCount: n }`.
  - If does not exist:
    - `INSERT INTO setup_likes (user_id, setup_id) VALUES ($uid, $sid);`
    - `UPDATE setups SET like_count = like_count + 1 WHERE id = $sid;`
    - Return `{ liked: true, likeCount: n }`.
- Status: `200 OK`.

---

## 4. Verification & Acceptance Criteria
1. Querying the feed returns only public setups.
2. Filtering by surface type (e.g. `surfaceType=granite_rock`) returns matching records utilizing PostgreSQL indexes.
3. Rapid clicking on the like endpoint toggles the state reliably without causing race condition count drifts.
4. Keyset cursor pagination smoothly advances through pages without duplicate records.
