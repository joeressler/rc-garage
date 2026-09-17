import { z } from 'zod';
import { apiJson } from './http';
import type { VehicleClass, VehicleScale } from './qr';

export type { VehicleClass, VehicleScale };

export const VEHICLE_SCALES = [
  '1/24',
  '1/18',
  '1/10',
  '1/8',
  '1/7',
  '1/5',
] as const satisfies readonly VehicleScale[];

export const VEHICLE_CLASSES = [
  'crawler_scale',
  'rock_bouncer',
  'comp_crawler_pro',
  'buggy_2wd',
  'buggy_4wd',
  'short_course',
  'touring_onroad',
  'drift_rwd',
  'monster_truck',
] as const satisfies readonly VehicleClass[];

export const VehicleScaleEnum = z.enum(VEHICLE_SCALES);
export const VehicleClassEnum = z.enum(VEHICLE_CLASSES);

export const CreateVehicleSchema = z.object({
  name: z.string().min(1, 'Name the chassis bay').max(60),
  make: z.string().min(1, 'Manufacturer is required').max(50),
  model: z.string().min(1, 'Model is required').max(50),
  scale: VehicleScaleEnum.default('1/10'),
  vehicleClass: VehicleClassEnum.default('crawler_scale'),
});

export const UpdateVehicleSchema = CreateVehicleSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export type CreateVehicleDto = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicleDto = z.infer<typeof UpdateVehicleSchema>;

export interface Vehicle {
  id: string;
  userId: string;
  name: string;
  make: string;
  model: string;
  scale: VehicleScale;
  vehicleClass: VehicleClass;
  isArchived: boolean;
  setupCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteVehicleResult {
  deleted: true;
  id: string;
}

export type VehicleDraft = {
  name: string;
  make: string;
  model: string;
  scale: VehicleScale;
  vehicleClass: VehicleClass;
};

export const EMPTY_VEHICLE_DRAFT: VehicleDraft = {
  name: '',
  make: '',
  model: '',
  scale: '1/10',
  vehicleClass: 'crawler_scale',
};

/**
 * Purpose: flatten Zod issues into the first message per chassis form field.
 */
export function vehicleFormErrors(error: z.ZodError): Partial<Record<keyof VehicleDraft, string>> {
  const fields: Partial<Record<keyof VehicleDraft, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (
      key === 'name' ||
      key === 'make' ||
      key === 'model' ||
      key === 'scale' ||
      key === 'vehicleClass'
    ) {
      if (!fields[key]) {
        fields[key] = issue.message;
      }
    }
  }
  return fields;
}

export function apiListVehicles(token: string): Promise<Vehicle[]> {
  return apiJson<Vehicle[]>('/api/garage/vehicles', {
    method: 'GET',
    token,
  });
}

export function apiCreateVehicle(token: string, payload: CreateVehicleDto): Promise<Vehicle> {
  return apiJson<Vehicle>('/api/garage/vehicles', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function apiUpdateVehicle(
  token: string,
  vehicleId: string,
  updates: UpdateVehicleDto,
): Promise<Vehicle> {
  return apiJson<Vehicle>(`/api/garage/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(updates),
  });
}

export function apiDeleteVehicle(token: string, vehicleId: string): Promise<DeleteVehicleResult> {
  return apiJson<DeleteVehicleResult>(
    `/api/garage/vehicles/${encodeURIComponent(vehicleId)}`,
    {
      method: 'DELETE',
      token,
    },
  );
}
