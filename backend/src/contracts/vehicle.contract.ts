import { z } from 'zod';
import { MotorTypeEnum } from './setup.contract';

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

/**
 * Purpose: shop links must be navigable http(s) URLs so javascript: and other schemes cannot ride inspect hyperlinks.
 */
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

export function parseChassisElectronics(value: unknown): ChassisElectronics {
  const parsed = ChassisElectronicsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export const CreateVehicleSchema = z.object({
  name: z.string().min(1).max(60),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
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

const ArchivedQuerySchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']),
]);

export const ListVehiclesQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    archived: ArchivedQuerySchema.optional().transform((value) => {
      if (value === undefined) {
        return false;
      }
      return value === true || value === 'true';
    }),
  }),
);

export const VehicleIdSchema = z.string().uuid();

export type VehicleScale = z.infer<typeof VehicleScaleEnum>;
export type VehicleClass = z.infer<typeof VehicleClassEnum>;
export type ElectronicsComponent = z.infer<typeof ElectronicsComponentSchema>;
export type MotorElectronics = z.infer<typeof MotorElectronicsSchema>;
export type BatteryElectronics = z.infer<typeof BatteryElectronicsSchema>;
export type ServoElectronics = z.infer<typeof ServoElectronicsSchema>;
export type ChassisElectronics = z.infer<typeof ChassisElectronicsSchema>;
export type CreateVehicleDto = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicleDto = z.infer<typeof UpdateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof ListVehiclesQuerySchema>;

export interface VehicleEntity {
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

export interface VehicleSetupSummary {
  id: string;
  vehicleId: string;
  userId: string;
  title: string;
  isPublic: boolean;
  calculatedFdr: number;
  frontBiasPercentage: number;
  surfaceType: string;
  forkCount: number;
  likeCount: number;
  qrSlug: string;
  isForked: boolean;
  createdAt: string;
}

export interface VehicleWithSetupsEntity extends VehicleEntity {
  setups: VehicleSetupSummary[];
}

export interface DeleteVehicleResult {
  deleted: true;
  id: string;
}
