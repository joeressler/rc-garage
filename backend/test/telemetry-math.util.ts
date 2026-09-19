/**
 * Purpose: verify FDR/CoG telemetry formulas used when cloning setup sheets.
 */
import {
  calculateCogBias,
  calculateFdr,
} from '../src/modules/setups/utils/telemetry-math.util';

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

function main(): void {
  const fourteenOnFiftySix = calculateFdr({
    pinionTeeth: 14,
    spurTeeth: 56,
    transmissionInternalRatio: 3,
  });
  assert(
    fourteenOnFiftySix === 12,
    `14/56 * 3 FDR should be 12, got ${fourteenOnFiftySix}`,
  );

  const twelveOnFiftySix = calculateFdr({
    pinionTeeth: 12,
    spurTeeth: 56,
    transmissionInternalRatio: 3,
  });
  assert(
    twelveOnFiftySix === 14,
    `12/56 * 3 FDR should be 14, got ${twelveOnFiftySix}`,
  );

  const withPortals = calculateFdr({
    pinionTeeth: 14,
    spurTeeth: 56,
    transmissionInternalRatio: 3,
    portalGearsInstalled: true,
    portalBoxRatio: 2,
  });
  assert(withPortals === 24, `portal FDR should be 24, got ${withPortals}`);

  const losiLmt = calculateFdr({
    pinionTeeth: 19,
    spurTeeth: 35,
    transmissionInternalRatio: 10.16,
  });
  assert(
    losiLmt === 18.72,
    `LMT 19/35 * 10.16 FDR should be 18.72, got ${losiLmt}`,
  );

  const cog = calculateCogBias(1480, 2500);
  assert(cog.frontBiasPercentage === 59.2, `front bias should be 59.2, got ${cog.frontBiasPercentage}`);
  assert(cog.rearBiasPercentage === 40.8, `rear bias should be 40.8, got ${cog.rearBiasPercentage}`);
  assert(
    cog.frontBiasPercentage + cog.rearBiasPercentage === 100,
    'front plus rear bias must equal 100',
  );

  console.log('telemetry math unit: all checks passed');
}

main();
