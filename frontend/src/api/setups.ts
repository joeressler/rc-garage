import { z } from 'zod';
import { apiJson } from './http';

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

// Crawler 3-gear boxes sit near 2.5–3.0:1; 3-speed monster-truck boxes (Losi LMT 10.16:1) need more headroom.
export const TRANSMISSION_INTERNAL_RATIO_MIN = 1.0;
export const TRANSMISSION_INTERNAL_RATIO_MAX = 12.0;

export const DrivetrainSettingsObjectSchema = z.object({
  pinionTeeth: z
    .number()
    .int()
    .min(9, 'Pinion must have at least 9 teeth')
    .max(60, 'Pinion must not exceed 60 teeth'),
  spurTeeth: z
    .number()
    .int()
    .min(30, 'Spur must have at least 30 teeth')
    .max(120, 'Spur must not exceed 120 teeth'),
  transmissionInternalRatio: z
    .number()
    .positive('Internal ratio must be positive')
    .min(TRANSMISSION_INTERNAL_RATIO_MIN, `Internal ratio minimum is ${TRANSMISSION_INTERNAL_RATIO_MIN.toFixed(1)}`)
    .max(TRANSMISSION_INTERNAL_RATIO_MAX, `Internal ratio maximum is ${TRANSMISSION_INTERNAL_RATIO_MAX.toFixed(1)}`),
  calculatedFdr: z.number().positive().optional(),
  gearPitch: GearPitchEnum.default('48P'),
  motorKv: z.number().int().min(500).max(12000).optional(),
  motorType: MotorTypeEnum.default('brushless_sensored'),
  batteryCellCount: z.number().int().min(1).max(8).default(3),
  underdriveOverdrivePercentage: z.number().min(-50).max(50).default(0),
});

export const DrivetrainSettingsSchema = DrivetrainSettingsObjectSchema.refine(
  (data) => data.spurTeeth > data.pinionTeeth,
  {
    message: 'Spur gear teeth must exceed pinion gear teeth',
    path: ['spurTeeth'],
  },
);

export const ShockSpecificationSchema = z.object({
  oilViscosityValue: z.number().positive().min(10, 'Min viscosity is 10').max(5000, 'Max viscosity is 5000'),
  oilViscosityUnit: FluidUnitEnum.default('CST'),
  springRateDescription: z.string().min(1, 'Spring rate is required').max(50),
  springRateLbsInch: z.number().positive().optional(),
  pistonHoles: z.number().int().min(1).max(8).default(2),
  pistonHoleDiameterMm: z.number().positive().min(0.5).max(3.0).default(1.2),
  shockLengthEyeToEyeMm: z.number().positive().min(50).max(160),
  camberAngleDeg: z.number().min(-8.0, 'Camber min is -8.0°').max(8.0, 'Camber max is +8.0°').default(0.0),
  toeAngleDeg: z.number().min(-8.0, 'Toe min is -8.0°').max(8.0, 'Toe max is +8.0°').default(0.0),
  rideHeightMm: z.number().min(0, 'Ride height cannot be negative').max(120),
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
  brand: z.string().min(1, 'Tire brand is required').max(50),
  model: z.string().min(1, 'Tire model is required').max(50),
  compound: z.string().min(1, 'Tire compound is required').max(50),
  wheelDiameterInch: z.number().positive().default(1.9),
  insertType: FoamInsertTypeEnum.default('dual_stage_foam'),
  brassWheelWeightGramsPerWheel: z.number().min(0).max(500).default(0),
  knuckleWeightGramsPerSide: z.number().min(0).max(300).default(0),
  ventedTireRims: z.boolean().default(false),
});

export const WeightDistributionObjectSchema = z.object({
  totalRtrWeightGrams: z.number().positive().min(200, 'Minimum RTR weight is 200g').max(25000, 'Maximum RTR weight is 25000g'),
  frontAxleWeightGrams: z.number().positive('Front axle weight must be positive'),
  rearAxleWeightGrams: z.number().positive('Rear axle weight must be positive'),
  frontWeightBiasPercentage: z.number().min(0).max(100).optional(),
  rearWeightBiasPercentage: z.number().min(0).max(100).optional(),
  batteryMountLocation: BatteryPositionEnum.default('center_low'),
});

export const WeightDistributionSchema = WeightDistributionObjectSchema.refine(
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
  vehicleId: z.string().uuid('Invalid vehicle identifier'),
  title: z.string().min(3, 'Setup title must have at least 3 characters').max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
  tags: z.array(z.string().min(2).max(30)).max(10).default([]),
  settings: SetupSettingsSchema,
});

export const UpdateSetupSchema = CreateSetupSchema.partial();

export const SetupIdSchema = z.string().uuid();

export const ListSetupsQuerySchema = z.preprocess(
  (value) => {
    const query = (value ?? {}) as Record<string, unknown>;
    if (query.vehicleId === '') {
      const rest = { ...query };
      delete rest.vehicleId;
      return rest;
    }
    return query;
  },
  z.object({
    vehicleId: z.string().uuid().optional(),
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

export interface DeleteSetupResult {
  deleted: true;
  id: string;
}

export interface TransmissionPreset {
  id: string;
  name: string;
  internalRatio: number;
}

export const TRANSMISSION_PRESETS: readonly TransmissionPreset[] = [
  { id: 'axial-2.6', name: 'Axial 3-Gear (2.60:1)', internalRatio: 2.6 },
  { id: 'traxxas-2.73', name: 'Traxxas TRX-4 (2.73:1)', internalRatio: 2.73 },
  { id: 'element-stealth-x', name: 'Element StealthX (2.81:1)', internalRatio: 2.81 },
  { id: 'vanquish-vfd', name: 'Vanquish VFD (2.55:1)', internalRatio: 2.55 },
  { id: 'losi-lmt-10.16', name: 'Losi LMT (10.16:1)', internalRatio: 10.16 },
  { id: 'direct-drive-1.0', name: 'Direct 1:1 Transfer (1.00:1)', internalRatio: 1.0 },
] as const;

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export interface FdrInputs {
  pinionTeeth: number;
  spurTeeth: number;
  transmissionInternalRatio: number;
  portalGearsInstalled?: boolean;
  portalBoxRatio?: number;
}

/**
 * Purpose: calculate Final Drive Ratio (FDR) on client with portal box awareness.
 */
export function calculateFdr(input: FdrInputs): number {
  if (input.pinionTeeth <= 0) return 0;
  const portalFactor =
    input.portalGearsInstalled === true &&
    typeof input.portalBoxRatio === 'number' &&
    input.portalBoxRatio > 0
      ? input.portalBoxRatio
      : 1;
  return roundTo(
    (input.spurTeeth / input.pinionTeeth) *
      input.transmissionInternalRatio *
      portalFactor,
    2,
  );
}

export interface CogBias {
  frontBiasPercentage: number;
  rearBiasPercentage: number;
}

/**
 * Purpose: calculate Center of Gravity (CoG) front/rear bias percentage.
 */
export function calculateCogBias(
  frontAxleWeightGrams: number,
  totalRtrWeightGrams: number,
): CogBias {
  if (totalRtrWeightGrams <= 0) {
    return { frontBiasPercentage: 50, rearBiasPercentage: 50 };
  }
  const frontBiasPercentage = roundTo(
    (frontAxleWeightGrams / totalRtrWeightGrams) * 100,
    1,
  );
  const rearBiasPercentage = roundTo(100 - frontBiasPercentage, 1);
  return { frontBiasPercentage, rearBiasPercentage };
}

export function cstToApproxWt(cst: number): number {
  return roundTo(cst / 12.14, 0);
}

export function wtToApproxCst(wt: number): number {
  return roundTo(wt * 12.14, 0);
}

export function defaultSetupSettings(): SetupSettings {
  const initialFdr = calculateFdr({
    pinionTeeth: 14,
    spurTeeth: 54,
    transmissionInternalRatio: 2.6,
  });
  const initialBias = calculateCogBias(1500, 2500);

  return {
    drivetrain: {
      pinionTeeth: 14,
      spurTeeth: 54,
      transmissionInternalRatio: 2.6,
      calculatedFdr: initialFdr,
      gearPitch: '48P',
      motorKv: 2100,
      motorType: 'brushless_sensored',
      batteryCellCount: 3,
      underdriveOverdrivePercentage: 0,
    },
    suspension: {
      front: {
        oilViscosityValue: 350,
        oilViscosityUnit: 'CST',
        springRateDescription: '1.4 lb/in (Blue)',
        springRateLbsInch: 1.4,
        pistonHoles: 2,
        pistonHoleDiameterMm: 1.2,
        shockLengthEyeToEyeMm: 90,
        camberAngleDeg: -1.5,
        toeAngleDeg: 1.0,
        rideHeightMm: 68,
        droopMm: 5,
        swayBarDiameterMm: 0,
      },
      rear: {
        oilViscosityValue: 300,
        oilViscosityUnit: 'CST',
        springRateDescription: '1.1 lb/in (Yellow)',
        springRateLbsInch: 1.1,
        pistonHoles: 2,
        pistonHoleDiameterMm: 1.2,
        shockLengthEyeToEyeMm: 90,
        camberAngleDeg: 0.0,
        toeAngleDeg: 0.0,
        rideHeightMm: 64,
        droopMm: 5,
        swayBarDiameterMm: 0,
      },
      portalGearsInstalled: false,
    },
    tiresAndWeight: {
      front: {
        brand: 'Pro-Line',
        model: 'Hyrax 1.9',
        compound: 'Predator',
        wheelDiameterInch: 1.9,
        insertType: 'dual_stage_foam',
        brassWheelWeightGramsPerWheel: 95,
        knuckleWeightGramsPerSide: 45,
        ventedTireRims: false,
      },
      rear: {
        brand: 'Pro-Line',
        model: 'Hyrax 1.9',
        compound: 'Predator',
        wheelDiameterInch: 1.9,
        insertType: 'dual_stage_foam',
        brassWheelWeightGramsPerWheel: 0,
        knuckleWeightGramsPerSide: 0,
        ventedTireRims: false,
      },
      weight: {
        totalRtrWeightGrams: 2500,
        frontAxleWeightGrams: 1500,
        rearAxleWeightGrams: 1000,
        frontWeightBiasPercentage: initialBias.frontBiasPercentage,
        rearWeightBiasPercentage: initialBias.rearBiasPercentage,
        batteryMountLocation: 'center_low',
      },
    },
    trackConditions: {
      surface: 'granite_rock',
      grip: 'high',
      ambientTempCelsius: 22,
      locationTag: 'Moab Rim',
    },
    driverNotes: '',
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  const parsed = finiteNumber(value, Number.NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function visibleText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function hiddenText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function prepareShock(
  spec: Partial<ShockSpecification> | undefined,
  fallback: ShockSpecification,
): ShockSpecification {
  const springRateLbsInch = optionalPositiveNumber(spec?.springRateLbsInch);
  const shockLength = finiteNumber(spec?.shockLengthEyeToEyeMm, fallback.shockLengthEyeToEyeMm);
  const pistonHoles = Math.round(finiteNumber(spec?.pistonHoles, fallback.pistonHoles));
  const pistonHoleDiameterMm = finiteNumber(
    spec?.pistonHoleDiameterMm,
    fallback.pistonHoleDiameterMm,
  );
  const droopMm = finiteNumber(spec?.droopMm, fallback.droopMm);
  const swayBarDiameterMm = finiteNumber(spec?.swayBarDiameterMm, fallback.swayBarDiameterMm ?? 0);

  return {
    oilViscosityValue: finiteNumber(spec?.oilViscosityValue, fallback.oilViscosityValue),
    oilViscosityUnit: FluidUnitEnum.safeParse(spec?.oilViscosityUnit).success
      ? (spec?.oilViscosityUnit as FluidUnit)
      : fallback.oilViscosityUnit,
    springRateDescription: visibleText(spec?.springRateDescription, fallback.springRateDescription),
    ...(springRateLbsInch !== undefined ? { springRateLbsInch } : {}),
    pistonHoles: inRange(pistonHoles, 1, 8) ? pistonHoles : fallback.pistonHoles,
    pistonHoleDiameterMm: inRange(pistonHoleDiameterMm, 0.5, 3)
      ? pistonHoleDiameterMm
      : fallback.pistonHoleDiameterMm,
    shockLengthEyeToEyeMm: inRange(shockLength, 50, 160)
      ? shockLength
      : fallback.shockLengthEyeToEyeMm,
    camberAngleDeg: finiteNumber(spec?.camberAngleDeg, fallback.camberAngleDeg),
    toeAngleDeg: finiteNumber(spec?.toeAngleDeg, fallback.toeAngleDeg),
    rideHeightMm: finiteNumber(spec?.rideHeightMm, fallback.rideHeightMm),
    droopMm: inRange(droopMm, 0, 50) ? droopMm : fallback.droopMm,
    swayBarDiameterMm: inRange(swayBarDiameterMm, 0, 5) ? swayBarDiameterMm : 0,
  };
}

function prepareTire(
  spec: Partial<AxleTireSpecification> | undefined,
  fallback: AxleTireSpecification,
): AxleTireSpecification {
  const wheelDiameterInch = finiteNumber(spec?.wheelDiameterInch, fallback.wheelDiameterInch);
  const knuckleWeightGramsPerSide = finiteNumber(
    spec?.knuckleWeightGramsPerSide,
    fallback.knuckleWeightGramsPerSide,
  );

  return {
    brand: hiddenText(spec?.brand, fallback.brand),
    model: hiddenText(spec?.model, fallback.model),
    compound: visibleText(spec?.compound, fallback.compound),
    wheelDiameterInch: wheelDiameterInch > 0 ? wheelDiameterInch : fallback.wheelDiameterInch,
    insertType: FoamInsertTypeEnum.safeParse(spec?.insertType).success
      ? (spec?.insertType as FoamInsertType)
      : fallback.insertType,
    brassWheelWeightGramsPerWheel: finiteNumber(
      spec?.brassWheelWeightGramsPerWheel,
      fallback.brassWheelWeightGramsPerWheel,
    ),
    knuckleWeightGramsPerSide: inRange(knuckleWeightGramsPerSide, 0, 300)
      ? knuckleWeightGramsPerSide
      : fallback.knuckleWeightGramsPerSide,
    ventedTireRims:
      typeof spec?.ventedTireRims === 'boolean' ? spec.ventedTireRims : fallback.ventedTireRims,
  };
}

/**
 * Purpose: keep clipboard save from failing on hidden/null telemetry that the editor cannot highlight.
 */
export function prepareSettingsForSave(settings: SetupSettings): SetupSettings {
  const defaults = defaultSetupSettings();
  const pinionTeeth = finiteNumber(settings.drivetrain?.pinionTeeth, defaults.drivetrain.pinionTeeth);
  const spurTeeth = finiteNumber(settings.drivetrain?.spurTeeth, defaults.drivetrain.spurTeeth);
  const transmissionInternalRatio = finiteNumber(
    settings.drivetrain?.transmissionInternalRatio,
    defaults.drivetrain.transmissionInternalRatio,
  );
  const portalGearsInstalled = settings.suspension?.portalGearsInstalled === true;
  const portalBoxRatio = optionalPositiveNumber(settings.suspension?.portalBoxRatio);
  const motorKv = optionalPositiveNumber(settings.drivetrain?.motorKv);
  const frontWeight = finiteNumber(
    settings.tiresAndWeight?.weight?.frontAxleWeightGrams,
    defaults.tiresAndWeight.weight.frontAxleWeightGrams,
  );
  const rearWeight = finiteNumber(
    settings.tiresAndWeight?.weight?.rearAxleWeightGrams,
    defaults.tiresAndWeight.weight.rearAxleWeightGrams,
  );
  const totalRtrWeightGrams = frontWeight + rearWeight;
  const bias = calculateCogBias(frontWeight, totalRtrWeightGrams);
  const batteryCellCount = Math.round(
    finiteNumber(settings.drivetrain?.batteryCellCount, defaults.drivetrain.batteryCellCount),
  );
  const underdriveOverdrivePercentage = finiteNumber(
    settings.drivetrain?.underdriveOverdrivePercentage,
    defaults.drivetrain.underdriveOverdrivePercentage,
  );
  const gearPitch = GearPitchEnum.safeParse(settings.drivetrain?.gearPitch);
  const motorType = MotorTypeEnum.safeParse(settings.drivetrain?.motorType);
  const batteryMount = BatteryPositionEnum.safeParse(
    settings.tiresAndWeight?.weight?.batteryMountLocation,
  );
  const surface = SurfaceTypeEnum.safeParse(settings.trackConditions?.surface);
  const grip = GripLevelEnum.safeParse(settings.trackConditions?.grip);

  return {
    drivetrain: {
      pinionTeeth,
      spurTeeth,
      transmissionInternalRatio,
      calculatedFdr: calculateFdr({
        pinionTeeth,
        spurTeeth,
        transmissionInternalRatio,
        portalGearsInstalled,
        portalBoxRatio,
      }),
      gearPitch: gearPitch.success ? gearPitch.data : defaults.drivetrain.gearPitch,
      ...(motorKv !== undefined && motorKv >= 500 && motorKv <= 12000
        ? { motorKv: Math.round(motorKv) }
        : {}),
      motorType: motorType.success ? motorType.data : defaults.drivetrain.motorType,
      batteryCellCount: inRange(batteryCellCount, 1, 8)
        ? batteryCellCount
        : defaults.drivetrain.batteryCellCount,
      underdriveOverdrivePercentage: inRange(underdriveOverdrivePercentage, -50, 50)
        ? underdriveOverdrivePercentage
        : defaults.drivetrain.underdriveOverdrivePercentage,
    },
    suspension: {
      front: prepareShock(settings.suspension?.front, defaults.suspension.front),
      rear: prepareShock(settings.suspension?.rear, defaults.suspension.rear),
      portalGearsInstalled,
      ...(portalBoxRatio !== undefined ? { portalBoxRatio } : {}),
      diffFluidFrontWeight: optionalText(settings.suspension?.diffFluidFrontWeight),
      diffFluidCenterWeight: optionalText(settings.suspension?.diffFluidCenterWeight),
      diffFluidRearWeight: optionalText(settings.suspension?.diffFluidRearWeight),
    },
    tiresAndWeight: {
      front: prepareTire(settings.tiresAndWeight?.front, defaults.tiresAndWeight.front),
      rear: prepareTire(settings.tiresAndWeight?.rear, defaults.tiresAndWeight.rear),
      weight: {
        totalRtrWeightGrams,
        frontAxleWeightGrams: frontWeight,
        rearAxleWeightGrams: rearWeight,
        frontWeightBiasPercentage: bias.frontBiasPercentage,
        rearWeightBiasPercentage: bias.rearBiasPercentage,
        batteryMountLocation: batteryMount.success
          ? batteryMount.data
          : defaults.tiresAndWeight.weight.batteryMountLocation,
      },
    },
    trackConditions: {
      surface: surface.success ? surface.data : defaults.trackConditions.surface,
      grip: grip.success ? grip.data : defaults.trackConditions.grip,
      ambientTempCelsius: optionalFiniteAmbient(settings.trackConditions?.ambientTempCelsius),
      locationTag: optionalText(settings.trackConditions?.locationTag),
    },
    driverNotes: visibleText(settings.driverNotes, ''),
  };
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalFiniteAmbient(value: unknown): number | undefined {
  const parsed = finiteNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function apiListSetups(token: string, vehicleId?: string): Promise<SetupSummary[]> {
  const query = vehicleId ? `?vehicleId=${encodeURIComponent(vehicleId)}` : '';
  return apiJson<SetupSummary[]>(`/api/garage/setups${query}`, {
    method: 'GET',
    token,
  });
}

export function apiGetSetup(setupId: string, token?: string | null): Promise<SetupEntity> {
  return apiJson<SetupEntity>(`/api/garage/setups/${encodeURIComponent(setupId)}`, {
    method: 'GET',
    token,
  });
}

export function apiCreateSetup(token: string, payload: CreateSetupDto): Promise<SetupEntity> {
  return apiJson<SetupEntity>('/api/garage/setups', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function apiUpdateSetup(
  token: string,
  setupId: string,
  payload: UpdateSetupDto,
): Promise<SetupEntity> {
  return apiJson<SetupEntity>(`/api/garage/setups/${encodeURIComponent(setupId)}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  });
}

export function apiDeleteSetup(token: string, setupId: string): Promise<DeleteSetupResult> {
  return apiJson<DeleteSetupResult>(`/api/garage/setups/${encodeURIComponent(setupId)}`, {
    method: 'DELETE',
    token,
  });
}
