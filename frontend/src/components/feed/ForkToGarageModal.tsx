import { useEffect, useState, type FormEvent } from 'react';
import type { Vehicle } from '../../stores/useGarageStore';

export interface ForkToGarageSource {
  id: string;
  title: string;
  authorCallsign?: string;
}

interface ForkToGarageModalProps {
  open: boolean;
  source: ForkToGarageSource | null;
  vehicles: Vehicle[];
  defaultVehicleId?: string;
  onClose: () => void;
  onConfirm: (payload: { targetVehicleId: string; title: string }) => Promise<void>;
}

/**
 * Purpose: assign a community or QR-inspected sheet onto a chassis the driver owns before forking.
 */
export function ForkToGarageModal({
  open,
  source,
  vehicles,
  defaultVehicleId,
  onClose,
  onConfirm,
}: ForkToGarageModalProps) {
  const [targetVehicleId, setTargetVehicleId] = useState('');
  const [forkTitle, setForkTitle] = useState('');
  const [isForking, setIsForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !source) {
      return;
    }
    setForkTitle(`Fork of ${source.title}`);
    setTargetVehicleId(defaultVehicleId || vehicles[0]?.id || '');
    setForkError(null);
    setIsForking(false);
  }, [open, source?.id, source?.title, defaultVehicleId, vehicles]);

  if (!open || !source) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!targetVehicleId) {
      setForkError('Please choose a vehicle in your garage.');
      return;
    }

    setIsForking(true);
    setForkError(null);
    try {
      await onConfirm({ targetVehicleId, title: forkTitle });
    } catch (err: unknown) {
      setForkError(err instanceof Error ? err.message : 'Fork failed');
    } finally {
      setIsForking(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fork-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-pit-black/80 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg border-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel">
        <div className="flex items-center justify-between border-b border-metal-border pb-3">
          <h2
            id="fork-modal-title"
            className="font-display text-lg font-bold uppercase tracking-wider text-readout-bright"
          >
            Fork Telemetry into Garage
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-sm text-readout-muted hover:text-readout-bright"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-4">
          {forkError ? (
            <p className="border border-nitromethane/50 bg-nitromethane/10 p-2 font-mono text-xs text-nitromethane">
              {forkError}
            </p>
          ) : null}

          <div>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-readout-muted">
              Source Setup Sheet
            </span>
            <p className="font-display text-sm font-bold text-readout-bright">
              {source.title}{' '}
              {source.authorCallsign ? (
                <span className="font-mono text-xs font-normal text-hazard-orange">
                  (@{source.authorCallsign})
                </span>
              ) : null}
            </p>
          </div>

          <div>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
                New Setup Title
              </span>
              <input
                type="text"
                required
                value={forkTitle}
                onChange={(event) => setForkTitle(event.target.value)}
                className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </label>
          </div>

          <div>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
                Assign to Fleet Vehicle
              </span>
              {vehicles.length > 0 ? (
                <select
                  value={targetVehicleId}
                  onChange={(event) => setTargetVehicleId(event.target.value)}
                  className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} — {vehicle.make} {vehicle.model} ({vehicle.scale})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 font-mono text-xs text-hazard-orange">
                  You need at least one vehicle in your garage to fork a setup sheet.
                </p>
              )}
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-metal-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="border border-metal-border bg-pit-black px-4 py-2 font-mono text-xs uppercase tracking-wider text-readout-dim hover:text-readout-bright"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isForking || vehicles.length === 0}
              className="border border-hazard-orange bg-hazard-orange px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-pit-black hover:bg-hazard-orange/90 disabled:opacity-50"
            >
              {isForking ? 'Forking Spec…' : 'Fork Setup Sheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
