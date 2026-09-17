import { roundTo } from './setups';

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

interface DiffField {
  path: string;
  category: DiffCategory;
  format: 'teeth' | 'viscosity' | 'degrees' | 'mm' | 'grams' | 'ratio' | 'text';
  unitPath?: string;
}

const DIFF_FIELDS: DiffField[] = [
  {
    path: 'drivetrain.pinionTeeth',
    category: 'drivetrain',
    format: 'teeth',
  },
  {
    path: 'drivetrain.spurTeeth',
    category: 'drivetrain',
    format: 'teeth',
  },
  {
    path: 'drivetrain.transmissionInternalRatio',
    category: 'drivetrain',
    format: 'ratio',
  },
  {
    path: 'drivetrain.calculatedFdr',
    category: 'drivetrain',
    format: 'ratio',
  },
  {
    path: 'suspension.front.oilViscosityValue',
    category: 'suspension',
    format: 'viscosity',
    unitPath: 'suspension.front.oilViscosityUnit',
  },
  {
    path: 'suspension.rear.oilViscosityValue',
    category: 'suspension',
    format: 'viscosity',
    unitPath: 'suspension.rear.oilViscosityUnit',
  },
  {
    path: 'suspension.front.camberAngleDeg',
    category: 'suspension',
    format: 'degrees',
  },
  {
    path: 'suspension.rear.camberAngleDeg',
    category: 'suspension',
    format: 'degrees',
  },
  {
    path: 'suspension.front.toeAngleDeg',
    category: 'suspension',
    format: 'degrees',
  },
  {
    path: 'suspension.rear.toeAngleDeg',
    category: 'suspension',
    format: 'degrees',
  },
  {
    path: 'suspension.front.rideHeightMm',
    category: 'suspension',
    format: 'mm',
  },
  {
    path: 'suspension.rear.rideHeightMm',
    category: 'suspension',
    format: 'mm',
  },
  {
    path: 'tiresAndWeight.front.compound',
    category: 'tiresAndWeight',
    format: 'text',
  },
  {
    path: 'tiresAndWeight.rear.compound',
    category: 'tiresAndWeight',
    format: 'text',
  },
  {
    path: 'tiresAndWeight.front.brassWheelWeightGramsPerWheel',
    category: 'tiresAndWeight',
    format: 'grams',
  },
  {
    path: 'tiresAndWeight.rear.brassWheelWeightGramsPerWheel',
    category: 'tiresAndWeight',
    format: 'grams',
  },
  {
    path: 'tiresAndWeight.weight.frontAxleWeightGrams',
    category: 'tiresAndWeight',
    format: 'grams',
  },
  {
    path: 'tiresAndWeight.weight.rearAxleWeightGrams',
    category: 'tiresAndWeight',
    format: 'grams',
  },
];

/**
 * Purpose: produce a diagnostic comparison tree of mechanical deviations between ancestor sheet and fork.
 */
export function computeSetupDiff(
  parentSettings: unknown,
  currentSettings: unknown,
): SetupDiff {
  const drivetrain: SetupDiffEntry[] = [];
  const suspension: SetupDiffEntry[] = [];
  const tiresAndWeight: SetupDiffEntry[] = [];

  for (const field of DIFF_FIELDS) {
    const parentValue = getPath(parentSettings, field.path);
    const currentValue = getPath(currentSettings, field.path);
    const parentPresent = !isAbsent(parentValue);
    const currentPresent = !isAbsent(currentValue);

    if (!parentPresent && !currentPresent) {
      continue;
    }

    if (!parentPresent && currentPresent) {
      const entry: SetupDiffEntry = {
        path: field.path,
        category: field.category,
        kind: 'added',
        parentValue: null,
        currentValue,
      };
      bucket(field.category, entry, drivetrain, suspension, tiresAndWeight);
      continue;
    }

    if (parentPresent && !currentPresent) {
      const entry: SetupDiffEntry = {
        path: field.path,
        category: field.category,
        kind: 'removed',
        parentValue,
        currentValue: null,
      };
      bucket(field.category, entry, drivetrain, suspension, tiresAndWeight);
      continue;
    }

    if (Object.is(parentValue, currentValue)) {
      continue;
    }

    const entry: SetupDiffEntry = {
      path: field.path,
      category: field.category,
      kind: 'modified',
      parentValue,
      currentValue,
    };

    if (typeof parentValue === 'number' && typeof currentValue === 'number') {
      const delta = roundTo(currentValue - parentValue, 4);
      entry.delta = delta;
      const unit =
        field.unitPath !== undefined
          ? String(
              getPath(currentSettings, field.unitPath) ??
                getPath(parentSettings, field.unitPath) ??
                '',
            )
          : undefined;
      entry.deltaLabel = formatDeltaLabel(delta, field.format, unit);
    }

    bucket(field.category, entry, drivetrain, suspension, tiresAndWeight);
  }

  return {
    drivetrain,
    suspension,
    tiresAndWeight,
    entries: [...drivetrain, ...suspension, ...tiresAndWeight],
  };
}

function bucket(
  category: DiffCategory,
  entry: SetupDiffEntry,
  drivetrain: SetupDiffEntry[],
  suspension: SetupDiffEntry[],
  tiresAndWeight: SetupDiffEntry[],
): void {
  if (category === 'drivetrain') {
    drivetrain.push(entry);
    return;
  }
  if (category === 'suspension') {
    suspension.push(entry);
    return;
  }
  tiresAndWeight.push(entry);
}

function getPath(source: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null;
}

function formatDeltaLabel(
  delta: number,
  format: DiffField['format'],
  unit?: string,
): string {
  if (format === 'teeth') {
    return `${signed(delta, 0)}T`;
  }
  if (format === 'viscosity') {
    const unitLabel = unit && unit.length > 0 ? unit : 'WT';
    return `${signed(delta, 1)} ${unitLabel}`;
  }
  if (format === 'degrees') {
    return `${signed(delta, 1)}°`;
  }
  if (format === 'mm') {
    return `${signed(delta, 1)} mm`;
  }
  if (format === 'grams') {
    return `${signed(delta, 1)} g`;
  }
  if (format === 'ratio') {
    return signed(delta, 2);
  }
  return signed(delta, 2);
}

function signed(delta: number, decimals: number): string {
  const rounded = roundTo(delta, decimals);
  const body =
    decimals === 0
      ? String(Math.trunc(rounded))
      : trimTrailingZeros(rounded.toFixed(decimals));
  if (rounded > 0) {
    return `+${body}`;
  }
  return body;
}

function trimTrailingZeros(value: string): string {
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
