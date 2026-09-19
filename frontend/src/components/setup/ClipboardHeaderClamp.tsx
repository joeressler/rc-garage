import { formatChassisStencil } from '../../lib/vehicle-labels';
import { useGarageStore } from '../../stores/useGarageStore';
import { useSetupStore } from '../../stores/useSetupStore';
import { ClipboardTagsField } from './ClipboardTagsField';

interface ClipboardHeaderClampProps {
  onInspectParentDiff?: () => void;
}

/**
 * Purpose: render the heavy metal binder clip header, chassis identity plate, scrutineering stamp, and fork lineage.
 */
export function ClipboardHeaderClamp({ onInspectParentDiff }: ClipboardHeaderClampProps) {
  const activeSetup = useSetupStore((state) => state.activeSetup);
  const meta = useSetupStore((state) => state.meta);
  const targetVehicleId = useSetupStore((state) => state.targetVehicleId);
  const updateMeta = useSetupStore((state) => state.updateMeta);
  const validationErrors = useSetupStore((state) => state.validationErrors);

  const vehicles = useGarageStore((state) => state.vehicles);
  const activeVehicle = vehicles.find((v) => v.id === (targetVehicleId ?? activeSetup?.vehicleId));

  const isSaved = !!activeSetup?.id;
  const isForked = !!activeSetup?.forkedFromSetupId;

  return (
    <header className="relative mb-6 rounded-t border-t-4 border-l-2 border-r-2 border-metal-highlight bg-gradient-to-b from-pit-steel via-pit-grease to-pit-black p-4 shadow-beveled-panel sm:p-6">
      {/* Heavy metal clip clamp motif */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
        <div className="h-4 w-32 rounded-t-sm border-t-2 border-l-2 border-r-2 border-metal-highlight bg-metal-border shadow-md" />
        <div className="absolute top-1 h-2 w-20 rounded-sm bg-pit-rubber border border-metal-highlight/50" />
      </div>

      <span className="hex-rivet left-3 top-3" />
      <span className="hex-rivet right-3 top-3" />
      <span className="hex-rivet bottom-3 left-3" />
      <span className="hex-rivet bottom-3 right-3" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {/* Chassis Identification Plate */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hazard-orange">
              Drawer 02 · Setup Clipboard
            </span>
            {isSaved ? (
              <span className="border border-metal-border bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-readout-dim">
                SLUG: /s/{activeSetup.qrSlug}
              </span>
            ) : (
              <span className="border border-hazard-stripe bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-nitromethane">
                DRAFT BENCH SHEET
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-3xl uppercase tracking-wide text-readout-bright sm:text-4xl">
              {activeVehicle ? `${activeVehicle.make} ${activeVehicle.model}` : 'Unassigned Chassis'}
            </h1>
            {activeVehicle ? (
              <span className="border border-metal-border bg-pit-black px-2.5 py-1 font-display text-xs uppercase tracking-widest text-hazard-orange">
                {formatChassisStencil(activeVehicle.vehicleClass, activeVehicle.scale)}
              </span>
            ) : null}
          </div>

          {activeVehicle ? (
            <p className="font-mono text-xs text-readout-dim">
              BAY: <span className="text-readout-bright">{activeVehicle.name}</span>
            </p>
          ) : (
            <p className="font-mono text-xs text-hazard-orange">
              No chassis assigned. Select an active bay in Fleet Garage.
            </p>
          )}

          {/* Title Editor */}
          <div className="pt-2">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-readout-muted">
                Setup Sheet Title
              </span>
              <input
                type="text"
                value={meta.title}
                onChange={(e) => updateMeta({ title: e.target.value })}
                placeholder="e.g. Moab Slickrock Low-CoG Comp Spec"
                maxLength={100}
                className={`mt-1 w-full max-w-lg border bg-pit-black px-3 py-1.5 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange ${
                  validationErrors.title ? 'border-hazard-stripe' : 'border-metal-border'
                }`}
              />
            </label>
            {validationErrors.title ? (
              <p className="mt-1 font-mono text-[10px] text-hazard-orange">
                {validationErrors.title}
              </p>
            ) : null}
          </div>

          <ClipboardTagsField />
        </div>

        {/* Right Badges: Scrutineering Stamp & Fork Lineage */}
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {/* Official Scrutineering Pass Stamp */}
          <div className="rotate-[-2deg] border-2 border-neon-radio px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.18em] text-neon-radio shadow-neon-glow">
            VERIFIED SCRUTINEERING
          </div>

          {/* Fork lineage indicator */}
          {isForked ? (
            <div className="flex items-center gap-2 border border-nitromethane/50 bg-pit-black/80 px-2.5 py-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-nitromethane">
                FORK OF ANCESTOR
              </span>
              {onInspectParentDiff ? (
                <button
                  type="button"
                  onClick={onInspectParentDiff}
                  className="font-mono text-[10px] text-readout-dim underline hover:text-readout-bright"
                >
                  View Diff
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Visibility indicator */}
          <div className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
            STATUS:{' '}
            <span className={meta.isPublic ? 'text-neon-radio font-bold' : 'text-readout-dim'}>
              {meta.isPublic ? 'PUBLIC TELEMETRY' : 'PRIVATE PITS'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
