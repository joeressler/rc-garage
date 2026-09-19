import { z } from 'zod';
import { apiJson } from './http';
import type { VehicleClass, VehicleScale } from './qr';
import { MotorTypeEnum, type MotorType } from './setups';

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

export const RADIO_BOX_SLOTS = [
  { key: 'motor', label: 'Motor' },
  { key: 'esc', label: 'ESC' },
  { key: 'steeringServo', label: 'Steering servo' },
  { key: 'receiver', label: 'Receiver' },
  { key: 'battery', label: 'Battery' },
  { key: 'winch', label: 'Winch' },
  { key: 'lightKit', label: 'Light kit' },
] as const;

export type RadioBoxSlotKey = (typeof RADIO_BOX_SLOTS)[number]['key'];

export const VehicleScaleEnum = z.enum(VEHICLE_SCALES);
export const VehicleClassEnum = z.enum(VEHICLE_CLASSES);

function blankToUndefined(value: unknown): unknown {
  if (value === '' || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

function optionalInt(min: number, max: number) {
  return z.preprocess((value) => {
    const next = blankToUndefined(value);
    if (typeof next === 'string') {
      const parsed = Number(next);
      return Number.isFinite(parsed) ? parsed : next;
    }
    return next;
  }, z.number().int().min(min).max(max).optional());
}

function optionalNumber(min: number, max: number) {
  return z.preprocess((value) => {
    const next = blankToUndefined(value);
    if (typeof next === 'string') {
      const parsed = Number(next);
      return Number.isFinite(parsed) ? parsed : next;
    }
    return next;
  }, z.number().min(min).max(max).optional());
}

export const ProductUrlSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .max(500)
    .refine((url) => /^https?:\/\//i.test(url), {
      message: 'Product link must start with http:// or https://',
    })
    .optional(),
);

export const ElectronicsComponentSchema = z.object({
  name: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  productUrl: ProductUrlSchema,
});

export const MotorElectronicsSchema = ElectronicsComponentSchema.extend({
  motorType: z.preprocess(blankToUndefined, MotorTypeEnum.optional()),
  kv: optionalInt(500, 12000),
});

export const BatteryElectronicsSchema = ElectronicsComponentSchema.extend({
  cellCount: optionalInt(1, 8),
});

export const ServoElectronicsSchema = ElectronicsComponentSchema.extend({
  torqueKg: optionalNumber(1, 100),
});

export const ChassisElectronicsSchema = z.object({
  motor: MotorElectronicsSchema.optional(),
  esc: ElectronicsComponentSchema.optional(),
  steeringServo: ServoElectronicsSchema.optional(),
  receiver: ElectronicsComponentSchema.optional(),
  battery: BatteryElectronicsSchema.optional(),
  winch: ElectronicsComponentSchema.optional(),
  lightKit: ElectronicsComponentSchema.optional(),
});

export const CreateVehicleSchema = z.object({
  name: z.string().min(1, 'Name the chassis bay').max(60),
  make: z.string().min(1, 'Manufacturer is required').max(50),
  model: z.string().min(1, 'Model is required').max(50),
  scale: VehicleScaleEnum.default('1/10'),
  vehicleClass: VehicleClassEnum.default('crawler_scale'),
  electronics: ChassisElectronicsSchema.optional(),
});

export const UpdateVehicleSchema = CreateVehicleSchema.omit({
  electronics: true,
})
  .partial()
  .extend({
    isArchived: z.boolean().optional(),
    electronics: ChassisElectronicsSchema.optional(),
  });

export type CreateVehicleDto = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicleDto = z.infer<typeof UpdateVehicleSchema>;
export type ElectronicsComponent = z.infer<typeof ElectronicsComponentSchema>;
export type MotorElectronics = z.infer<typeof MotorElectronicsSchema>;
export type BatteryElectronics = z.infer<typeof BatteryElectronicsSchema>;
export type ServoElectronics = z.infer<typeof ServoElectronicsSchema>;
export type ChassisElectronics = z.infer<typeof ChassisElectronicsSchema>;

export interface Vehicle {
  id: string;
  userId: string;
  name: string;
  make: string;
  model: string;
  scale: VehicleScale;
  vehicleClass: VehicleClass;
  isArchived: boolean;
  electronics: ChassisElectronics;
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
  electronics: ChassisElectronics;
};

export const EMPTY_CHASSIS_ELECTRONICS: ChassisElectronics = {};

export const EMPTY_VEHICLE_DRAFT: VehicleDraft = {
  name: '',
  make: '',
  model: '',
  scale: '1/10',
  vehicleClass: 'crawler_scale',
  electronics: EMPTY_CHASSIS_ELECTRONICS,
};

export type VehicleFormErrors = Record<string, string>;

/**
 * Purpose: flatten Zod issues, including dotted electronics paths, into the first message per field.
 */
export function vehicleFormErrors(error: z.ZodError): VehicleFormErrors {
  const fields: VehicleFormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.');
    if (!key || fields[key]) {
      continue;
    }
    fields[key] = issue.message;
  }
  return fields;
}

export function isHttpProductUrl(url: string | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

type RadioBoxComponent = ElectronicsComponent & {
  motorType?: MotorType;
  kv?: number;
  cellCount?: number;
  torqueKg?: number;
};

export function radioBoxSlotFilled(component: RadioBoxComponent | undefined): boolean {
  if (!component) {
    return false;
  }
  return Boolean(
    component.name?.trim() ||
      component.productUrl?.trim() ||
      component.motorType ||
      component.kv != null ||
      component.cellCount != null ||
      component.torqueKg != null,
  );
}

export function radioBoxTeaser(electronics: ChassisElectronics | undefined): string | null {
  if (!electronics) {
    return null;
  }
  for (const slot of RADIO_BOX_SLOTS) {
    const name = electronics[slot.key]?.name?.trim();
    if (name) {
      return name;
    }
  }
  return null;
}

export function electronicsHasSpec(electronics: ChassisElectronics | undefined): boolean {
  if (!electronics) {
    return false;
  }
  return RADIO_BOX_SLOTS.some((slot) => radioBoxSlotFilled(electronics[slot.key]));
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
