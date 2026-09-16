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
