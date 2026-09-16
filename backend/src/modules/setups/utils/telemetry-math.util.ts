import { SetupSettings } from '../../../contracts/setup.contract';

/**
 * Purpose: round telemetry readouts to the PostgreSQL column scale without float drift.
 */
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
 * Purpose: compute Final Drive Ratio from gearing, including portal boxes when installed.
 */
export function calculateFdr(input: FdrInputs): number {
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
 * Purpose: compute CoG axle bias percentages that always sum to 100%.
 */
export function calculateCogBias(
  frontAxleWeightGrams: number,
  totalRtrWeightGrams: number,
): CogBias {
  const frontBiasPercentage = roundTo(
    (frontAxleWeightGrams / totalRtrWeightGrams) * 100,
    1,
  );
  const rearBiasPercentage = roundTo(100 - frontBiasPercentage, 1);
  return { frontBiasPercentage, rearBiasPercentage };
}

export interface DerivedTelemetry {
  settings: SetupSettings;
  calculatedFdr: number;
  frontBiasPercentage: number;
}

/**
 * Purpose: stamp server-authoritative FDR and CoG values onto a setup settings blob.
 */
export function applyDerivedTelemetry(settings: SetupSettings): DerivedTelemetry {
  const calculatedFdr = calculateFdr({
    pinionTeeth: settings.drivetrain.pinionTeeth,
    spurTeeth: settings.drivetrain.spurTeeth,
    transmissionInternalRatio: settings.drivetrain.transmissionInternalRatio,
    portalGearsInstalled: settings.suspension.portalGearsInstalled,
    portalBoxRatio: settings.suspension.portalBoxRatio,
  });
  const { frontBiasPercentage, rearBiasPercentage } = calculateCogBias(
    settings.tiresAndWeight.weight.frontAxleWeightGrams,
    settings.tiresAndWeight.weight.totalRtrWeightGrams,
  );

  return {
    calculatedFdr,
    frontBiasPercentage,
    settings: {
      ...settings,
      drivetrain: {
        ...settings.drivetrain,
        calculatedFdr,
      },
      tiresAndWeight: {
        ...settings.tiresAndWeight,
        weight: {
          ...settings.tiresAndWeight.weight,
          frontWeightBiasPercentage: frontBiasPercentage,
          rearWeightBiasPercentage: rearBiasPercentage,
        },
      },
    },
  };
}
