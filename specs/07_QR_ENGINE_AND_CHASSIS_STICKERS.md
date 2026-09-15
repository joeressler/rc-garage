# Milestone 07: QR Code Generation & Static Chassis Inspection Engine

## 1. Objective
Implement the QR code sharing engine in NestJS and edge routing in React, delivering resilient, high-contrast QR codes formatted for physical 1.5" x 1.5" pit-box and chassis stickers, linked to lightweight mobile inspection views.

---

## 2. Scope & Target Files
- `/backend/src/modules/qr/qr.module.ts`
- `/backend/src/modules/qr/qr.controller.ts`
- `/backend/src/modules/qr/qr.service.ts`
- `/frontend/src/views/PublicInspectionView.tsx`
- `/frontend/src/components/qr/ChassisStickerPrinter.tsx`
- `/backend/src/contracts/qr.contract.ts`

---

## 3. Detailed Technical Requirements

### 3.1 QR Code Specification
- **Error Correction Level:** Level `H` (~30% error recovery). Essential for surviving outdoor trail mud, oil splatters, and chassis abrasions.
- **Slug Generation:** Nanoid alphanumeric string (10 characters, URL-safe: `[a-zA-Z0-9_-]`).
- **Target URL Structure:** `${APP_BASE_URL}/s/:qr_slug` (e.g. `https://rc-garage.community/s/v9k2pq1x8m`).
- **Output Formats:**
  - `SVG`: Scalable vector for high-density vinyl label printing.
  - `PNG`: Pre-rendered bitmap at 300 DPI for direct download/export.

### 3.2 Backend QR Service & Controller (`/api/garage/setups/:id/qr`)
1. **`GET /api/garage/setups/:id/qr`**
   - Query Parameters:
     - `format`: `'svg' | 'png'` (default `'svg'`).
     - `size`: number (default `512` px).
     - `margin`: number (quiet zone, default `2` modules).
   - Action:
     - Fetches setup record; resolves `qr_slug`.
     - Generates QR matrix with Level `H` error correction.
     - Emits binary SVG or PNG stream with appropriate `Content-Type: image/svg+xml` or `image/png`.
   - Status: `200 OK`.

2. **`GET /api/garage/qr/resolve/:slug`**
   - Param: `slug` (10-char string).
   - Action: Resolves `setup_id` and redirects or returns setup summary for public inspection.
   - Status: `200 OK`.

### 3.3 Public Static Chassis Inspection Route (`/s/:slug`)
- SPA route in React that loads instantly without requiring authentication.
- Fetches setup data using the slug.
- Displays an ultra-clean, mobile-first pit-mat inspection card:
  - Vehicle Make, Model, Class badge.
  - Calculated FDR and battery cell count.
  - Shock oil CST/WT ratings and tire compound tags.
  - Scrutineering stamp and verified badge.
  - One-tap CTA: "Fork this setup into your Garage".

### 3.4 Physical Chassis Sticker Print Template
- Pre-composed 1.5" x 1.5" sticker component:
  - High-contrast black QR matrix on white background.
  - Header: Chassis name (e.g. "VS4-10 Phoenix").
  - Footer: Calculated FDR ("FDR: 10.80:1") and short URL slug.
  - Print CSS styling (`@media print`) disabling margins and toolbars.

---

## 4. Verification & Acceptance Criteria
1. Generated QR codes scan reliably on mobile camera apps from 6 to 18 inches away.
2. QR codes with up to 25% obstructed or smudged modules remain decodable due to Level `H` error correction.
3. Accessing `/s/:slug` on mobile renders a complete mechanical sheet in under 1 second.
4. SVG output scales infinitely without pixelation when sent to vinyl cutter/plotter software.
