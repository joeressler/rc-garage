# Milestone 11: Setup Sheet Clipboard Inspection Workbench & Live Telemetry Store

## 1. Objective
Implement the interactive Setup Sheet Clipboard editor and the reactive `useSetupStore`, featuring real-time client-side calculation of Final Drive Ratio (FDR), Center of Gravity (CoG) weight distribution bars, shock dyno readouts, and persistence to the backend.

---

## 2. Scope & Target Files
- `/frontend/src/stores/useSetupStore.ts`
- `/frontend/src/views/SetupClipboardView.tsx`
- `/frontend/src/components/setup/ClipboardHeaderClamp.tsx`
- `/frontend/src/components/setup/DrivetrainToolboxCard.tsx`
- `/frontend/src/components/setup/TireAndBalanceToolboxCard.tsx`
- `/frontend/src/components/setup/SuspensionDynoCard.tsx`
- `/frontend/src/components/setup/TrackEnvironmentNotesCard.tsx`
- `/frontend/src/components/setup/ClipboardActionBar.tsx`

---

## 3. Detailed Technical Requirements

### 3.1 Zustand Setup Store (`frontend/src/stores/useSetupStore.ts`)
Handles live client-side calculations so adjusting sliders updates telemetry displays instantaneously without network requests:
- **`updateGearing(pinion, spur, internalRatio)`:**
  Computes $\text{FDR} = (\text{spur} / \text{pinion}) \times \text{internalRatio}$ and updates state.
- **`updateWeights(frontWeight, rearWeight)`:**
  Computes total weight and front/rear bias percentages.
- **`updateSuspensionCorner(axle, specUpdates)`:**
  Updates front or rear shock settings (oil viscosity, camber, toe, spring rate).
- **`saveCurrentSetup()`:**
  Validates state against Zod schema and calls `POST` or `PUT /api/garage/setups`.

### 3.2 Visual UI Components & Layout Motifs
1. **`ClipboardHeaderClamp`:**
   - Visual header styled like an embossed heavy metal binder clip.
   - Chassis identification plate: Make, Model, Scale, Class.
   - Official scrutineering pass stamp in neon green (`font-mono font-bold border-2 border-neon-radio text-neon-radio px-3 py-1 rotate-[-2deg]`).
   - Lineage indicator if forked from another driver.
2. **`DrivetrainToolboxCard`:**
   - Interactive dual range sliders for Pinion teeth (9..60T) and Spur teeth (30..120T).
   - Dropdown for internal transmission ratio presets (e.g. Axial 2.6:1, Traxxas 2.73:1, Element StealthX).
   - LED Digital Readout for calculated FDR in bright hazard orange (`font-mono text-2xl text-hazard-orange bg-pit-black p-3 rounded border border-metal-border`).
3. **`TireAndBalanceToolboxCard`:**
   - Front and rear axle tire compound and foam insert selectors.
   - Stepper counters for brass wheel weights (grams per wheel).
   - CoG Balance Scale Bar: Analog two-tone progress bar displaying front vs. rear weight bias percentage with center equilibrium marker.
4. **`SuspensionDynoCard`:**
   - Side-by-side front and rear shock dyno inspection cards.
   - Viscosity dual readout (e.g. "35 WT / 425 CST" in anodized blue).
   - Alignment dials showing camber (-8° to +8°) and toe angles.
5. **`ClipboardActionBar`:**
   - Heavy-duty toggle button: "Public / Private".
   - Primary action: "Save Telemetry Sheet" (`bg-hazard-orange hover:bg-hazard-stripe`).
   - Secondary action: "Print Chassis QR" (`border border-neon-radio text-neon-radio`).

---

## 4. Verification & Acceptance Criteria
1. Dragging the pinion slider recalculates and displays the new FDR in real time (<16ms response).
2. Entering front and rear corner weights immediately animates the CoG distribution balance bar.
3. Attempting to save with invalid gearing (e.g. pinion >= spur) highlights the input in red with an inline error message.
4. Saving a new setup assigns a `qr_slug` and transitions the view into saved inspection mode.
