import React from 'react';
import type { SetupDiffEntry } from '../../api/diff';

interface SideBySideSpecTableProps {
  entries: SetupDiffEntry[];
  parentTitle?: string;
  currentTitle?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  drivetrain: 'Drivetrain & Gearing',
  suspension: 'Suspension & Shocks',
  tiresAndWeight: 'Tires & Chassis Ballast',
};

const FIELD_LABELS: Record<string, string> = {
  'drivetrain.pinionTeeth': 'Pinion Teeth',
  'drivetrain.spurTeeth': 'Spur Teeth',
  'drivetrain.transmissionInternalRatio': 'Internal Ratio',
  'drivetrain.calculatedFdr': 'Final Drive Ratio (FDR)',
  'suspension.front.oilViscosityValue': 'Front Shock Viscosity',
  'suspension.rear.oilViscosityValue': 'Rear Shock Viscosity',
  'suspension.front.camberAngleDeg': 'Front Camber Angle',
  'suspension.rear.camberAngleDeg': 'Rear Camber Angle',
  'suspension.front.toeAngleDeg': 'Front Toe Angle',
  'suspension.rear.toeAngleDeg': 'Rear Toe Angle',
  'suspension.front.rideHeightMm': 'Front Ride Height',
  'suspension.rear.rideHeightMm': 'Rear Ride Height',
  'tiresAndWeight.front.compound': 'Front Tire Compound',
  'tiresAndWeight.rear.compound': 'Rear Tire Compound',
  'tiresAndWeight.front.brassWheelWeightGramsPerWheel': 'Front Brass Weight / Wheel',
  'tiresAndWeight.rear.brassWheelWeightGramsPerWheel': 'Rear Brass Weight / Wheel',
  'tiresAndWeight.weight.frontAxleWeightGrams': 'Front Axle Ready Weight',
  'tiresAndWeight.weight.rearAxleWeightGrams': 'Rear Axle Ready Weight',
};

/**
 * Purpose: render a two-column mechanical comparison table highlighting modified tuning values and deltas between parent and fork.
 */
export function SideBySideSpecTable({
  entries,
  parentTitle = 'Parent Ancestor Spec',
  currentTitle = 'Forked Chassis Spec',
}: SideBySideSpecTableProps) {
  if (entries.length === 0) {
    return (
      <div className="border border-metal-border bg-pit-black p-8 text-center font-mono text-xs text-readout-dim">
        No mechanical differences detected between parent sheet and this fork. All telemetry specs are identical.
      </div>
    );
  }

  // Group by category
  const categories = ['drivetrain', 'suspension', 'tiresAndWeight'] as const;

  return (
    <div className="overflow-x-auto border border-metal-border bg-pit-black">
      <table className="w-full text-left font-mono text-xs">
        <thead>
          <tr className="border-b-2 border-metal-border bg-pit-grease text-[10px] uppercase tracking-wider text-readout-muted">
            <th className="p-3">Mechanical Parameter</th>
            <th className="p-3">{parentTitle}</th>
            <th className="p-3">{currentTitle}</th>
            <th className="p-3 text-right">Tuning Delta</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const catEntries = entries.filter((e) => e.category === cat);
            if (catEntries.length === 0) return null;

            return (
              <React.Fragment key={cat}>
                <tr className="border-b border-metal-border bg-pit-steel/60">
                  <td
                    colSpan={4}
                    className="p-2 font-display text-xs font-bold uppercase tracking-widest text-hazard-orange"
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                  </td>
                </tr>
                {catEntries.map((entry) => {
                  const label = FIELD_LABELS[entry.path] ?? entry.path;
                  const isModified = entry.kind === 'modified';
                  const parentDisplay =
                    entry.parentValue !== null && entry.parentValue !== undefined
                      ? String(entry.parentValue)
                      : '—';
                  const currentDisplay =
                    entry.currentValue !== null && entry.currentValue !== undefined
                      ? String(entry.currentValue)
                      : '—';

                  return (
                    <tr
                      key={entry.path}
                      className="border-b border-metal-border/50 transition hover:bg-pit-grease/40"
                    >
                      <td className="p-3 text-readout-dim">{label}</td>
                      <td className="p-3 text-readout-muted font-medium">{parentDisplay}</td>
                      <td
                        className={`p-3 font-semibold ${
                          isModified ? 'text-nitromethane font-bold' : 'text-readout-bright'
                        }`}
                      >
                        {currentDisplay}
                      </td>
                      <td className="p-3 text-right">
                        {entry.deltaLabel ? (
                          <span className="inline-block rounded border border-nitromethane/50 bg-nitromethane/10 px-2 py-0.5 text-[11px] font-bold text-nitromethane">
                            {entry.deltaLabel}
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase text-readout-muted">
                            {entry.kind}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

