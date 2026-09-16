# Milestone 07: QR Code Generation & Static Chassis Inspection Engine

## 1. Objective
Implement the QR code sharing engine in NestJS, delivering resilient, high-contrast QR codes formatted for physical 1.5" x 1.5" pit-box and chassis stickers. React edge routing (`/s/:slug`), the public inspection view, and the 1.5" sticker print template are deferred to Milestone 09, when the SPA is scaffolded.

---

## 2. Scope & Target Files
- `/backend/src/modules/qr/qr.module.ts`
- `/backend/src/modules/qr/qr.controller.ts`
- `/backend/src/modules/qr/qr.service.ts`
- `/backend/src/modules/qr/utils/qr-url.util.ts`
- `/backend/src/contracts/qr.contract.ts`

Frontend files deferred to Milestone 09:
- `/frontend/src/views/PublicInspectionView.tsx`
- `/frontend/src/components/qr/ChassisStickerPrinter.tsx`

---

## 3. Detailed Technical Requirements

### 3.1 QR Code Specification
- **Error Correction Level:** Level `H` (~30% error recovery). Essential for surviving outdoor trail mud, oil splatters, and chassis abrasions.
- **Slug Generation:** Nanoid alphanumeric string (10 characters, URL-safe: `[a-zA-Z0-9_-]`). Already allocated on setup create/fork; do not regenerate on update.
- **Target URL Structure:** `${APP_BASE_URL}/s/:qr_slug` (e.g. `https://rc-garage.community/s/v9k2pq1x8m`).
- **Output Formats:**
  - `SVG`: Scalable vector for high-density vinyl label printing.
  - `PNG`: Pre-rendered bitmap at 300 DPI for direct download/export.

### 3.2 Backend QR Service & Controller (`/api/garage/setups/:id/qr`)
1. **`GET /api/garage/setups/:id/qr`**
   - Auth: none (setup UUID is the capability token; owners can print stickers before publishing).
   - Query Parameters:
     - `format`: `'svg' | 'png'` (default `'svg'`).
     - `size`: number (default `512` px; callers pass `450` for 1.5" @ 300 DPI).
     - `margin`: number (quiet zone, default `2` modules).
   - Action:
     - Fetches setup record; resolves `qr_slug`.
     - Generates QR matrix with Level `H` error correction encoding `${APP_BASE_URL}/s/:qr_slug`.
     - Emits binary SVG or PNG stream with appropriate `Content-Type: image/svg+xml` or `image/png`.
     - Must not wrap the stream in the JSON REST envelope.
   - Status: `200 OK`. Missing setup: `404`.

2. **`GET /api/garage/qr/resolve/:slug`**
   - Auth: none.
   - Param: `slug` (10-char URL-safe string).
   - Action: Join `setups` to `vehicles` and return a `PublicInspectionSheet` JSON summary for the future `/s/:slug` SPA view. Require `is_public = TRUE`. Do not 302-redirect.
   - Status: `200 OK`. Missing, unknown, or private slug: `404`.

### 3.3 Public Static Chassis Inspection Route (`/s/:slug`) — Milestone 09
Deferred until the React SPA exists. Milestone 09 must add `PublicInspectionView.tsx` and register `/s/:slug` as an unauthenticated route that loads `GET /api/garage/qr/resolve/:slug`.

### 3.4 Physical Chassis Sticker Print Template — Milestone 09 / 12
Deferred until the React SPA exists. Milestone 09 must add `ChassisStickerPrinter.tsx` (1.5" x 1.5" high-contrast template). Milestone 12's `QrPitStickerPrinterModal` composes that printer component for download/print actions.

---

## 4. Verification & Acceptance Criteria
1. Generated PNG QR codes decode to `${APP_BASE_URL}/s/:qr_slug` (Level `H` matrix).
2. SVG output is a raw `image/svg+xml` stream (not JSON) that scales without raster pixelation.
3. `GET /qr/resolve/:slug` returns an enveloped public inspection summary; private slugs 404.
4. React `/s/:slug` rendering and vinyl print UI are verified in Milestone 09 / 12, not this milestone.
