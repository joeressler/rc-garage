# Milestone 04: Digital Garage Vehicles Fleet API

## 1. Objective
Implement the vehicle management domain in NestJS, allowing authenticated drivers to register, inspect, update, and manage the fleet of RC chassis in their garage.

---

## 2. Scope & Target Files
- `/backend/src/modules/vehicles/vehicles.module.ts`
- `/backend/src/modules/vehicles/vehicles.controller.ts`
- `/backend/src/modules/vehicles/vehicles.service.ts`
- `/backend/src/modules/vehicles/dto/create-vehicle.dto.ts`
- `/backend/src/modules/vehicles/dto/update-vehicle.dto.ts`
- `/backend/src/contracts/vehicle.contract.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Zod Schemas & DTO Contracts
```typescript
import { z } from 'zod';

export const VehicleScaleEnum = z.enum([
  '1/24',
  '1/18',
  '1/10',
  '1/8',
  '1/7',
  '1/5',
]);

export const VehicleClassEnum = z.enum([
  'crawler_scale',
  'rock_bouncer',
  'comp_crawler_pro',
  'buggy_2wd',
  'buggy_4wd',
  'short_course',
  'touring_onroad',
  'drift_rwd',
  'monster_truck',
]);

export const CreateVehicleSchema = z.object({
  name: z.string().min(1).max(60),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  scale: VehicleScaleEnum.default('1/10'),
  vehicleClass: VehicleClassEnum.default('crawler_scale'),
});

export const UpdateVehicleSchema = CreateVehicleSchema.partial().extend({
  isArchived: z.boolean().optional(),
});
```

### 3.2 Vehicle Controller Routes (`/api/garage/vehicles`)
1. **`POST /api/garage/vehicles`**
   - Protected: `JwtAuthGuard`.
   - Body: `CreateVehicleSchema`.
   - Action: Inserts new vehicle associated with `req.user.id`.
   - Status: `201 Created`.

2. **`GET /api/garage/vehicles`**
   - Protected: `JwtAuthGuard`.
   - Query: `?archived=false` (default false).
   - Action: Fetches all vehicles owned by the authenticated driver.
   - Status: `200 OK`.

3. **`GET /api/garage/vehicles/:id`**
   - Protected: `JwtAuthGuard`.
   - Param: `id` (UUID).
   - Action: Fetches specific vehicle including count of associated setups and setup summaries.
   - Status: `200 OK`.
   - Error: `404 Not Found` if vehicle does not exist or does not belong to user.

4. **`PUT /api/garage/vehicles/:id`**
   - Protected: `JwtAuthGuard`.
   - Param: `id` (UUID).
   - Body: `UpdateVehicleSchema`.
   - Action: Validates ownership and applies partial update.
   - Status: `200 OK`.

5. **`DELETE /api/garage/vehicles/:id`**
   - Protected: `JwtAuthGuard`.
   - Param: `id` (UUID).
   - Action: Soft-deletes (`is_archived = true`) or hard-deletes if no public setups are linked.
   - Status: `200 OK` with `{ deleted: true, id: string }`.

---

## 4. Verification & Acceptance Criteria
1. Unauthenticated requests to vehicle endpoints return `401 Unauthorized`.
2. Drivers cannot read, update, or delete vehicles belonging to other users (`404 Not Found` or `403 Forbidden`).
3. Invalid scale or vehicle class strings fail Zod validation with descriptive messages.
4. Retrieving a vehicle list includes setup counts for accurate garage UI rendering.
