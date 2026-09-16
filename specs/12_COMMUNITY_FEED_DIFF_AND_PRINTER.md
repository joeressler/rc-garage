# Milestone 12: Community Feed, Fork Diff Workbench, Sticker Printer & Integration Verification

## 1. Objective
Implement the community discovery feed UI, side-by-side fork diff inspector, physical QR chassis sticker printer modal, and end-to-end integration verification across all services.

---

## 2. Scope & Target Files
- `/frontend/src/views/CommunityFeedWorkbench.tsx`
- `/frontend/src/components/feed/FeedFilterDrawer.tsx`
- `/frontend/src/components/feed/SetupSheetCard.tsx`
- `/frontend/src/components/diff/ForkDiffInspectorModal.tsx`
- `/frontend/src/components/diff/SideBySideSpecTable.tsx`
- `/frontend/src/components/qr/QrPitStickerPrinterModal.tsx`
- `/frontend/src/components/qr/ChassisStickerPrinter.tsx` (created in Milestone 09; this milestone composes it — do not fork a second sticker layout)
- `/tests/e2e/garage-workflow.spec.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Community Feed Workbench (`frontend/src/views/CommunityFeedWorkbench.tsx`)
- Multi-vector filter bar:
  - Surface type selector (Granite, Slick rock, Packed dirt, Indoor clay, Carpet).
  - Vehicle class chips.
  - Sorting toggles: "Newest", "Most Forked", "Top Rated".
- Setup cards grid:
  - Author callsign stencil watermark.
  - Vehicle thumbnail, class, and scale.
  - Fast telemetry stats: FDR, Front CoG %, Shock Oil CST.
  - Community counters: Fork count and Like count with interactive heart toggle.
  - Action buttons: "Inspect Setup Sheet", "Fork to My Garage".

### 3.2 Fork Diff Inspector Modal (`frontend/src/components/diff/ForkDiffInspectorModal.tsx`)
- Opens when viewing a forked setup with a linked parent.
- Two-column mechanical comparison table:
  - Left column: Ancestor / Parent setup specifications.
  - Right column: Active setup specifications.
- Delta highlight engine:
  - Modified values highlighted in `text-nitromethane` with delta chips (e.g. `+1.5 WT`, `-2T Pinion`).
  - Identical values rendered in muted gray (`text-readout-dim`).

### 3.3 QR Pit-Sticker Printer Modal (`frontend/src/components/qr/QrPitStickerPrinterModal.tsx`)
- Renders an interactive 1:1 scale preview of the 1.5" x 1.5" vinyl chassis sticker by **composing** Milestone 09's `ChassisStickerPrinter` (do not reimplement the 1.5" matrix/header/footer markup).
- Features:
  - High-resolution SVG rendering with Level 'H' error correction matrix via `GET /api/garage/setups/:id/qr`.
  - Top label with Vehicle Make & Model.
  - Bottom badge with FDR ratio and `/s/:slug` short URL.
- Export options:
  - "Download Scalable Vector (SVG)" for vinyl cutters.
  - "Download 300 DPI Bitmap (PNG)" (`?format=png&size=450`) for sticker paper printers.
  - "Direct Print Sheet" triggering browser `@media print` layout formatting from `ChassisStickerPrinter`.

### 3.4 Comprehensive Integration & Verification Plan
1. **End-to-End Workflow Verification:**
   - Register driver `@TrailBoss`.
   - Add new vehicle: "Element Enduro Sendero HD" (1/10 Scale Crawler).
   - Create setup sheet "Moab Slickrock Spec" (Pinion 14T, Spur 56T, 30 WT oil, 60% front bias).
   - Verify public setup appears in Community Feed.
   - Register second driver `@RockHound`.
   - Add vehicle: "Axial SCX10 III".
   - Fork "Moab Slickrock Spec" into `@RockHound`'s garage.
   - Change pinion to 12T. Verify parent setup retains 14T, and fork shows delta `-2T` in Diff Inspector.
   - Scan generated QR code on mobile or test browser; verify public inspection sheet loads instantly.
2. **Container Boundary Verification:**
   - Confirm `docker-compose.yml` launches all 3 services (`rc-db`, `rc-backend`, `rc-frontend`) within 640MB combined RAM.
   - Verify PostgreSQL rejects direct connections on port 5432 from outside Docker network.

---

## 4. Verification & Acceptance Criteria
1. Community Feed allows seamless browsing, filtering, and liking of setups without reloads.
2. Fork Diff Inspector accurately displays mechanical deviations between parent and child setups.
3. QR sticker downloads produce clean 300 DPI assets formatted for 1.5" physical printing.
4. Milestone 12 UI and integration checks pass; subsequent admin moderation capabilities are specified separately in Milestone 13.
