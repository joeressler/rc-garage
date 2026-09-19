import { z } from 'zod';
import {
  BatteryPositionEnum,
  FluidUnitEnum,
  FoamInsertTypeEnum,
  GearPitchEnum,
  GripLevelEnum,
  MotorTypeEnum,
  SurfaceTypeEnum,
  TRANSMISSION_INTERNAL_RATIO_MAX,
  TRANSMISSION_INTERNAL_RATIO_MIN,
} from './setup.contract';

const DrivetrainOverrideSchema = z.object({
  pinionTeeth: z.number().int().min(9).max(60).optional(),
  spurTeeth: z.number().int().min(30).max(120).optional(),
  transmissionInternalRatio: z
    .number()
    .positive()
    .min(TRANSMISSION_INTERNAL_RATIO_MIN)
    .max(TRANSMISSION_INTERNAL_RATIO_MAX)
    .optional(),
  calculatedFdr: z.number().positive().optional(),
  gearPitch: GearPitchEnum.optional(),
  motorKv: z.number().int().min(500).max(12000).optional(),
  motorType: MotorTypeEnum.optional(),
  batteryCellCount: z.number().int().min(1).max(8).optional(),
  underdriveOverdrivePercentage: z.number().min(-50).max(50).optional(),
});

const ShockOverrideSchema = z.object({
  oilViscosityValue: z.number().positive().min(10).max(5000).optional(),
  oilViscosityUnit: FluidUnitEnum.optional(),
  springRateDescription: z.string().min(1).max(50).optional(),
  springRateLbsInch: z.number().positive().optional(),
  pistonHoles: z.number().int().min(1).max(8).optional(),
  pistonHoleDiameterMm: z.number().positive().min(0.5).max(3.0).optional(),
  shockLengthEyeToEyeMm: z.number().positive().min(50).max(160).optional(),
  camberAngleDeg: z.number().min(-8.0).max(8.0).optional(),
  toeAngleDeg: z.number().min(-8.0).max(8.0).optional(),
  rideHeightMm: z.number().min(0).max(120).optional(),
  droopMm: z.number().min(0).max(50).optional(),
  swayBarDiameterMm: z.number().min(0).max(5.0).optional(),
});

const SuspensionOverrideSchema = z.object({
  front: ShockOverrideSchema.optional(),
  rear: ShockOverrideSchema.optional(),
  diffFluidFrontWeight: z.string().optional(),
  diffFluidCenterWeight: z.string().optional(),
  diffFluidRearWeight: z.string().optional(),
  portalGearsInstalled: z.boolean().optional(),
  portalBoxRatio: z.number().positive().optional(),
});

const TireOverrideSchema = z.object({
  brand: z.string().min(1).max(50).optional(),
  model: z.string().min(1).max(50).optional(),
  compound: z.string().min(1).max(50).optional(),
  wheelDiameterInch: z.number().positive().optional(),
  insertType: FoamInsertTypeEnum.optional(),
  brassWheelWeightGramsPerWheel: z.number().min(0).max(500).optional(),
  knuckleWeightGramsPerSide: z.number().min(0).max(300).optional(),
  ventedTireRims: z.boolean().optional(),
});

const WeightOverrideSchema = z.object({
  totalRtrWeightGrams: z.number().positive().min(200).max(25000).optional(),
  frontAxleWeightGrams: z.number().positive().optional(),
  rearAxleWeightGrams: z.number().positive().optional(),
  frontWeightBiasPercentage: z.number().min(0).max(100).optional(),
  rearWeightBiasPercentage: z.number().min(0).max(100).optional(),
  batteryMountLocation: BatteryPositionEnum.optional(),
});

const TrackConditionsOverrideSchema = z.object({
  surface: SurfaceTypeEnum.optional(),
  grip: GripLevelEnum.optional(),
  ambientTempCelsius: z.number().min(-20).max(60).optional(),
  locationTag: z.string().max(80).optional(),
});

/**
 * Purpose: accept sparse mechanical overrides that are merged onto a cloned ancestor sheet.
 */
export const SetupSettingsOverrideSchema = z.object({
  drivetrain: DrivetrainOverrideSchema.optional(),
  suspension: SuspensionOverrideSchema.optional(),
  tiresAndWeight: z
    .object({
      front: TireOverrideSchema.optional(),
      rear: TireOverrideSchema.optional(),
      weight: WeightOverrideSchema.optional(),
    })
    .optional(),
  trackConditions: TrackConditionsOverrideSchema.optional(),
  driverNotes: z.string().max(2000).optional(),
});

export const ForkSetupSchema = z.object({
  targetVehicleId: z.string().uuid(),
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  settingOverrides: SetupSettingsOverrideSchema.optional(),
});

export type ForkSetupDto = z.infer<typeof ForkSetupSchema>;
export type SetupSettingsOverride = z.infer<typeof SetupSettingsOverrideSchema>;

export type DiffChangeKind = 'added' | 'removed' | 'modified';
export type DiffCategory = 'drivetrain' | 'suspension' | 'tiresAndWeight';

export interface SetupDiffEntry {
  path: string;
  category: DiffCategory;
  kind: DiffChangeKind;
  parentValue: unknown;
  currentValue: unknown;
  delta?: number;
  deltaLabel?: string;
}

export interface SetupDiff {
  drivetrain: SetupDiffEntry[];
  suspension: SetupDiffEntry[];
  tiresAndWeight: SetupDiffEntry[];
  entries: SetupDiffEntry[];
}
