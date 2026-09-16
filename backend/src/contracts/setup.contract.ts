import { z } from 'zod';

export const MotorTypeEnum = z.enum([
  'brushed',
  'brushless_sensored',
  'brushless_sensorless',
]);

export const GearPitchEnum = z.enum(['48P', '32P', 'mod0.8', 'mod1.0', '64P']);

export const FluidUnitEnum = z.enum(['WT', 'CST']);

export const FoamInsertTypeEnum = z.enum([
  'single_stage_foam',
  'dual_stage_foam',
  'printed_silicone_matrix',
  'air_pocket',
  'none',
]);

export const BatteryPositionEnum = z.enum([
  'front_tray',
  'rear_tray',
  'center_low',
  'chassis_slider_left',
  'chassis_slider_right',
  'forward_axle_mount',
]);

export const SurfaceTypeEnum = z.enum([
  'granite_rock',
  'slick_rock',
  'river_stone',
  'packed_dirt',
  'loose_loam',
  'clay_indoor',
  'carpet_offroad',
  'asphalt',
  'snow_ice',
]);

export const GripLevelEnum = z.enum(['low', 'medium', 'high', 'extreme']);

export const DrivetrainSettingsSchema = z
  .object({
    pinionTeeth: z
      .number()
      .int()
      .min(9, 'Pinion must have at least 9 teeth')
      .max(60),
    spurTeeth: z
      .number()
      .int()
      .min(30, 'Spur must have at least 30 teeth')
      .max(120),
    transmissionInternalRatio: z.number().positive().min(1.0).max(6.0),
    calculatedFdr: z.number().positive().optional(),
    gearPitch: GearPitchEnum.default('48P'),
    motorKv: z.number().int().min(500).max(12000).optional(),
    motorType: MotorTypeEnum.default('brushless_sensored'),
    batteryCellCount: z.number().int().min(1).max(8).default(3),
    underdriveOverdrivePercentage: z.number().min(-50).max(50).default(0),
  })
  .refine((data) => data.spurTeeth > data.pinionTeeth, {
    message: 'Spur gear teeth must exceed pinion gear teeth',
    path: ['spurTeeth'],
  });

export const ShockSpecificationSchema = z.object({
  oilViscosityValue: z.number().positive().min(10).max(5000),
  oilViscosityUnit: FluidUnitEnum.default('CST'),
  springRateDescription: z.string().min(1).max(50),
  springRateLbsInch: z.number().positive().optional(),
  pistonHoles: z.number().int().min(1).max(8).default(2),
  pistonHoleDiameterMm: z.number().positive().min(0.5).max(3.0).default(1.2),
  shockLengthEyeToEyeMm: z.number().positive().min(50).max(160),
  camberAngleDeg: z.number().min(-8.0).max(8.0).default(0.0),
  toeAngleDeg: z.number().min(-8.0).max(8.0).default(0.0),
  rideHeightMm: z.number().min(0).max(120),
  droopMm: z.number().min(0).max(50).default(5),
  swayBarDiameterMm: z.number().min(0).max(5.0).optional(),
});

export const AxleSuspensionSchema = z.object({
  front: ShockSpecificationSchema,
  rear: ShockSpecificationSchema,
  diffFluidFrontWeight: z.string().optional(),
  diffFluidCenterWeight: z.string().optional(),
  diffFluidRearWeight: z.string().optional(),
  portalGearsInstalled: z.boolean().default(false),
  portalBoxRatio: z.number().positive().optional(),
});

export const AxleTireSpecificationSchema = z.object({
  brand: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  compound: z.string().min(1).max(50),
  wheelDiameterInch: z.number().positive().default(1.9),
  insertType: FoamInsertTypeEnum.default('dual_stage_foam'),
  brassWheelWeightGramsPerWheel: z.number().min(0).max(500).default(0),
  knuckleWeightGramsPerSide: z.number().min(0).max(300).default(0),
  ventedTireRims: z.boolean().default(false),
});

export const WeightDistributionSchema = z
  .object({
    totalRtrWeightGrams: z.number().positive().min(200).max(25000),
    frontAxleWeightGrams: z.number().positive(),
    rearAxleWeightGrams: z.number().positive(),
    frontWeightBiasPercentage: z.number().min(0).max(100).optional(),
    rearWeightBiasPercentage: z.number().min(0).max(100).optional(),
    batteryMountLocation: BatteryPositionEnum.default('center_low'),
  })
  .refine(
    (data) =>
      Math.abs(
        data.totalRtrWeightGrams -
          (data.frontAxleWeightGrams + data.rearAxleWeightGrams),
      ) <= 10,
    {
      message:
        'Front plus rear axle weights must equal total ready-to-run weight within a 10g tolerance',
      path: ['totalRtrWeightGrams'],
    },
  );

export const TiresAndWeightSchema = z.object({
  front: AxleTireSpecificationSchema,
  rear: AxleTireSpecificationSchema,
  weight: WeightDistributionSchema,
});

export const TrackConditionsSchema = z.object({
  surface: SurfaceTypeEnum.default('granite_rock'),
  grip: GripLevelEnum.default('high'),
  ambientTempCelsius: z.number().min(-20).max(60).optional(),
  locationTag: z.string().max(80).optional(),
});

export const SetupSettingsSchema = z.object({
  drivetrain: DrivetrainSettingsSchema,
  suspension: AxleSuspensionSchema,
  tiresAndWeight: TiresAndWeightSchema,
  trackConditions: TrackConditionsSchema,
  driverNotes: z.string().max(2000).optional(),
});

export const CreateSetupSchema = z.object({
  vehicleId: z.string().uuid(),
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
  tags: z.array(z.string().min(2).max(30)).max(10).default([]),
  settings: SetupSettingsSchema,
});

export const UpdateSetupSchema = CreateSetupSchema.partial();

export const SetupIdSchema = z.string().uuid();

export const ListSetupsQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    vehicleId: z.string().uuid(),
  }),
);

export type MotorType = z.infer<typeof MotorTypeEnum>;
export type GearPitch = z.infer<typeof GearPitchEnum>;
export type FluidUnit = z.infer<typeof FluidUnitEnum>;
export type FoamInsertType = z.infer<typeof FoamInsertTypeEnum>;
export type BatteryPosition = z.infer<typeof BatteryPositionEnum>;
export type SurfaceType = z.infer<typeof SurfaceTypeEnum>;
export type GripLevel = z.infer<typeof GripLevelEnum>;
export type DrivetrainSettings = z.infer<typeof DrivetrainSettingsSchema>;
export type ShockSpecification = z.infer<typeof ShockSpecificationSchema>;
export type AxleSuspension = z.infer<typeof AxleSuspensionSchema>;
export type AxleTireSpecification = z.infer<typeof AxleTireSpecificationSchema>;
export type WeightDistribution = z.infer<typeof WeightDistributionSchema>;
export type TiresAndWeight = z.infer<typeof TiresAndWeightSchema>;
export type TrackConditions = z.infer<typeof TrackConditionsSchema>;
export type SetupSettings = z.infer<typeof SetupSettingsSchema>;
export type CreateSetupDto = z.infer<typeof CreateSetupSchema>;
export type UpdateSetupDto = z.infer<typeof UpdateSetupSchema>;
export type ListSetupsQuery = z.infer<typeof ListSetupsQuerySchema>;

export interface SetupSummary {
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

export interface SetupEntity {
  id: string;
  vehicleId: string;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  tags: string[];
  qrSlug: string;
  calculatedFdr: number;
  frontBiasPercentage: number;
  surfaceType: string;
  locationTag: string | null;
  settings: SetupSettings;
  forkCount: number;
  likeCount: number;
  forkedFromSetupId: string | null;
  rootAncestorSetupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SetupDetailEntity = SetupEntity;

export interface DeleteSetupResult {
  deleted: true;
  id: string;
}
