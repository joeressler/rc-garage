# Milestone 05: Setup Sheet Logging Engine & Telemetry Mathematics

## 1. Objective
Implement the setup sheet logging domain in NestJS, including Zod validation for complex mechanical parameters, automated computation of Final Drive Ratio (FDR) and Center of Gravity (CoG) bias, and persistent storage in PostgreSQL JSONB.

---

## 2. Scope & Target Files
- `/backend/src/modules/setups/setups.module.ts`
- `/backend/src/modules/setups/setups.controller.ts`
- `/backend/src/modules/setups/setups.service.ts`
- `/backend/src/modules/setups/utils/telemetry-math.util.ts`
- `/backend/src/modules/setups/dto/create-setup.dto.ts`
- `/backend/src/modules/setups/dto/update-setup.dto.ts`
- `/backend/src/contracts/setup.contract.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Telemetry Math Utility (`telemetry-math.util.ts`)
1. **Final Drive Ratio (FDR) Calculation:**
   $$\text{FDR} = \left(\frac{\text{Spur Teeth}}{\text{Pinion Teeth}}\right) \times \text{Internal Transmission Ratio} \times \text{Portal Box Ratio (if applicable)}$$
   - Return rounded to two decimal places (e.g. `10.80`).
2. **Center of Gravity (CoG) Bias Percentage:**
   $$\text{Front Bias \%} = \left(\frac{\text{Front Axle Weight (g)}}{\text{Total RTR Weight (g)}}\right) \times 100$$
   $$\text{Rear Bias \%} = \left(\frac{\text{Rear Axle Weight (g)}}{\text{Total RTR Weight (g)}}\right) \times 100$$
   - Enforce front + rear = 100%.

### 3.2 Zod Validation Schemas
- **Drivetrain Schema:** Pinion (9..60), Spur (30..120), Internal Ratio (1.0..6.0), Gear pitch (`48P`, `32P`, `mod0.8`, `mod1.0`, `64P`), Motor KV, Motor type (`brushed`, `brushless_sensored`, `brushless_sensorless`), Battery cells (1..8). Enforce `spurTeeth > pinionTeeth`.
- **Suspension Schema:** Front/Rear shock oil viscosity (value: 10..5000, unit: `WT` or `CST`), spring rates, piston holes (1..8), piston diameter (0.5..3.0mm), eye-to-eye shock length (50..160mm), camber angles (-8.0°..+8.0°), toe angles (-8.0°..+8.0°), ride height (0..120mm), droop (0..50mm).
- **Tires & Weight Schema:** Front/Rear tire brand, model, compound, wheel diameter, foam insert type (`single_stage_foam`, `dual_stage_foam`, `printed_silicone_matrix`, `air_pocket`), brass weights per wheel (0..500g), knuckle weights (0..300g), ready-to-run vehicle corner weights.
- **Track Conditions & Notes:** Surface type (`granite_rock`, `slick_rock`, `clay_indoor`, etc.), grip level (`low`, `medium`, `high`, `extreme`), ambient temperature, location tags.

### 3.3 Setup Controller Routes (`/api/garage/setups`)
1. **`POST /api/garage/setups`**
   - Protected: `JwtAuthGuard`.
   - Body: `CreateSetupSchema`.
   - Action:
     - Verifies caller owns `vehicleId`.
     - Calculates FDR and front CoG bias percentage via `telemetry-math.util.ts`.
     - Generates unique 10-character `qr_slug` using `nanoid`.
     - Persists setup record with structured JSONB `settings`.
   - Status: `201 Created`.

2. **`GET /api/garage/setups`**
   - Protected: `JwtAuthGuard`.
   - Query: `?vehicleId=:uuid`.
   - Action: Returns setup summaries for the given vehicle.
   - Status: `200 OK`.

3. **`GET /api/garage/setups/:id`**
   - Public / Optional JWT: Returns setup sheet if `is_public === true` or if caller owns the setup.
   - Status: `200 OK`.
   - Error: `404 Not Found` if private and unowned.

4. **`PUT /api/garage/setups/:id`**
   - Protected: `JwtAuthGuard`.
   - Param: `id` (UUID).
   - Body: `Partial<CreateSetupSchema>`.
   - Action: Validates ownership, recomputes derived FDR/CoG, updates record.
   - Status: `200 OK`.

5. **`DELETE /api/garage/setups/:id`**
   - Protected: `JwtAuthGuard`.
   - Param: `id` (UUID).
   - Action: Verifies ownership and deletes setup.
   - Status: `200 OK`.

---

## 4. Verification & Acceptance Criteria
1. Submitting invalid gear combinations (e.g. Pinion > Spur) fails validation with `400 Bad Request`.
2. Total weight distribution mismatch (>10g discrepancy between axle sum and total) fails validation.
3. FDR and CoG front bias calculations match theoretical formulas exactly.
4. Setups are successfully stored in and retrieved from PostgreSQL JSONB columns.
