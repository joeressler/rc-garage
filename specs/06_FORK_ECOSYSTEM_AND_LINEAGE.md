# Milestone 06: Setup Cloning & Fork Provenance Ecosystem

## 1. Objective
Implement the setup cloning ("fork") ecosystem in NestJS, enabling drivers to duplicate public setups into their own garage, maintaining immutable lineage pointers, incrementing community fork counts, and generating side-by-side diagnostic diffs.

---

## 2. Scope & Target Files
- `/backend/src/modules/setups/fork.service.ts`
- `/backend/src/modules/setups/dto/fork-setup.dto.ts`
- `/backend/src/modules/setups/utils/diff-engine.util.ts`
- `/backend/src/modules/setups/setups.controller.ts` (Fork route)
- `/backend/src/contracts/fork.contract.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Lineage Data Model
Every setup row in PostgreSQL includes:
- `forked_from_setup_id`: Points to the immediate parent setup.
- `root_ancestor_setup_id`: Points to the original progenitor of the setup lineage tree.
- `fork_count`: Counter of how many times this setup has been cloned.

### 3.2 Fork Request Payload Contract
```typescript
import { z } from 'zod';
import { SetupSettingsSchema } from './create-setup.dto';

export const ForkSetupSchema = z.object({
  targetVehicleId: z.string().uuid(),
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  settingOverrides: SetupSettingsSchema.deepPartial().optional(),
});

export type ForkSetupDto = z.infer<typeof ForkSetupSchema>;
```

### 3.3 Fork Execution Flow (`POST /api/garage/setups/:id/fork`)
1. **Validation Phase:**
   - Look up source setup by `:id`.
   - Ensure source setup exists and is either `is_public === true` or owned by caller.
   - Look up `targetVehicleId`; verify it belongs to the authenticated driver.
2. **Deep-Merge Settings:**
   - Deep-clone source `settings` JSONB.
   - Recursively merge `settingOverrides` into the cloned settings.
3. **Telemetry Recalculation:**
   - Recalculate `calculated_fdr` and `front_bias_percentage` based on the new merged settings.
4. **Lineage Pointer Assignment:**
   - `forked_from_setup_id = source.id`
   - `root_ancestor_setup_id = source.root_ancestor_setup_id ?? source.id`
5. **Database Transaction:**
   - Execute inside an atomic transaction:
     ```sql
     INSERT INTO setups (
       vehicle_id, user_id, title, description, is_public,
       forked_from_setup_id, root_ancestor_setup_id, qr_slug,
       calculated_fdr, front_bias_percentage, surface_type,
       location_tag, settings, tags
     ) VALUES (...);

     UPDATE setups SET fork_count = fork_count + 1 WHERE id = $source_id;
     ```
6. **Return Created Setup:** Status `201 Created` with full setup entity.

### 3.4 Diagnostic Diff Engine (`diff-engine.util.ts`)
- Implement utility `computeSetupDiff(parentSettings, currentSettings)`:
  - Compares drivetrain parameters (teeth, FDR).
  - Compares suspension corners (viscosity, camber, toe, ride height).
  - Compares tire compounds and corner weights.
  - Returns a structured diff tree identifying `added`, `removed`, and `modified` numerical values with delta indicators (`+1.5 WT`, `-2T`).

---

## 4. Verification & Acceptance Criteria
1. Attempting to fork a private setup owned by someone else returns `403 Forbidden` or `404 Not Found`.
2. Attempting to fork into a vehicle owned by another user returns `403 Forbidden`.
3. Source setup's `fork_count` increments atomically by 1 upon successful fork.
4. Forked setup records the correct immediate parent and original root ancestor IDs.
5. Modifying the newly created fork never mutates the original source setup.
