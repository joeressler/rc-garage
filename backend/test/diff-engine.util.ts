/**
 * Purpose: verify diagnostic setup diffs emit labeled mechanical deltas for the fork inspector.
 */
import { computeSetupDiff } from '../src/modules/setups/utils/diff-engine.util';

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

function main(): void {
  const parent = {
    drivetrain: {
      pinionTeeth: 14,
      spurTeeth: 56,
      transmissionInternalRatio: 3,
      calculatedFdr: 12,
    },
    suspension: {
      front: {
        oilViscosityValue: 30,
        oilViscosityUnit: 'WT',
        camberAngleDeg: -1,
        toeAngleDeg: 0,
        rideHeightMm: 28,
      },
      rear: {
        oilViscosityValue: 30,
        oilViscosityUnit: 'WT',
        camberAngleDeg: -1,
        toeAngleDeg: 0,
        rideHeightMm: 28,
      },
    },
    tiresAndWeight: {
      front: { compound: 'Alien', brassWheelWeightGramsPerWheel: 0 },
      rear: { compound: 'Alien', brassWheelWeightGramsPerWheel: 0 },
      weight: { frontAxleWeightGrams: 1480, rearAxleWeightGrams: 1020 },
    },
  };

  const current = {
    drivetrain: {
      pinionTeeth: 12,
      spurTeeth: 56,
      transmissionInternalRatio: 3,
      calculatedFdr: 14,
    },
    suspension: {
      front: {
        oilViscosityValue: 31.5,
        oilViscosityUnit: 'WT',
        camberAngleDeg: -1,
        toeAngleDeg: 0.5,
        rideHeightMm: 26,
      },
      rear: {
        oilViscosityValue: 30,
        oilViscosityUnit: 'WT',
        camberAngleDeg: -1,
        toeAngleDeg: 0,
        rideHeightMm: 28,
      },
    },
    tiresAndWeight: {
      front: { compound: 'Super Soft', brassWheelWeightGramsPerWheel: 12 },
      rear: { compound: 'Alien', brassWheelWeightGramsPerWheel: 0 },
      weight: { frontAxleWeightGrams: 1480, rearAxleWeightGrams: 1020 },
    },
  };

  const diff = computeSetupDiff(parent, current);
  const pinion = diff.drivetrain.find((entry) => entry.path === 'drivetrain.pinionTeeth');
  assert(pinion?.kind === 'modified', 'pinion should be modified');
  assert(pinion?.delta === -2, `pinion delta should be -2, got ${pinion?.delta}`);
  assert(pinion?.deltaLabel === '-2T', `pinion label should be -2T, got ${pinion?.deltaLabel}`);

  const viscosity = diff.suspension.find(
    (entry) => entry.path === 'suspension.front.oilViscosityValue',
  );
  assert(viscosity?.kind === 'modified', 'front viscosity should be modified');
  assert(
    viscosity?.deltaLabel === '+1.5 WT',
    `viscosity label should be +1.5 WT, got ${viscosity?.deltaLabel}`,
  );

  const compound = diff.tiresAndWeight.find(
    (entry) => entry.path === 'tiresAndWeight.front.compound',
  );
  assert(compound?.kind === 'modified', 'front compound should be modified');
  assert(compound?.parentValue === 'Alien', 'compound parent should be Alien');
  assert(compound?.currentValue === 'Super Soft', 'compound current should be Super Soft');

  const unchangedSpur = diff.drivetrain.find((entry) => entry.path === 'drivetrain.spurTeeth');
  assert(unchangedSpur === undefined, 'unchanged spur should be omitted');

  const addedOnly = computeSetupDiff(
    { drivetrain: { spurTeeth: 56 } },
    { drivetrain: { pinionTeeth: 14, spurTeeth: 56 } },
  );
  const addedPinion = addedOnly.drivetrain.find(
    (entry) => entry.path === 'drivetrain.pinionTeeth',
  );
  assert(addedPinion?.kind === 'added', 'missing-to-present pinion should be added');

  const removedOnly = computeSetupDiff(
    { drivetrain: { pinionTeeth: 14 } },
    { drivetrain: {} },
  );
  const removedPinion = removedOnly.drivetrain.find(
    (entry) => entry.path === 'drivetrain.pinionTeeth',
  );
  assert(removedPinion?.kind === 'removed', 'present-to-missing pinion should be removed');

  console.log('diff engine unit: all checks passed');
}

main();
