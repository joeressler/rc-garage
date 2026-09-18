import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiListSetups, type SetupSummary } from '../../api/setups';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGarageStore } from '../../stores/useGarageStore';
import { useSetupStore } from '../../stores/useSetupStore';

type SetupBrowserScope = 'chassis' | 'account';

/**
 * Purpose: let a driver inspect sibling sheets on one chassis or browse every sheet in the garage without leaving the clipboard.
 */
export function ClipboardSetupSwitcher() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const vehicles = useGarageStore((state) => state.vehicles);
  const activeVehicleId = useGarageStore((state) => state.activeVehicleId);
  const selectVehicle = useGarageStore((state) => state.selectVehicle);

  const activeSetup = useSetupStore((state) => state.activeSetup);
  const targetVehicleId = useSetupStore((state) => state.targetVehicleId);
  const setTargetVehicleId = useSetupStore((state) => state.setTargetVehicleId);
  const initNewSetup = useSetupStore((state) => state.initNewSetup);
  const activateChassis = useSetupStore((state) => state.activateChassis);

  const chassisId = targetVehicleId ?? activeVehicleId ?? '';
  const [scope, setScope] = useState<SetupBrowserScope>('chassis');
  const [sheets, setSheets] = useState<SetupSummary[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const chassisSwitchGeneration = useRef(0);

  useEffect(() => {
    if (!token) {
      setSheets([]);
      return;
    }
    if (scope === 'chassis' && !chassisId) {
      setSheets([]);
      return;
    }

    let cancelled = false;
    setIsLoadingSheets(true);

    const vehicleFilter = scope === 'chassis' ? chassisId : undefined;
    apiListSetups(token, vehicleFilter)
      .then((data) => {
        if (!cancelled) {
          setSheets(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSheets([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSheets(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, scope, chassisId, activeSetup?.id, activeSetup?.title]);

  function inspectSheet(setup: SetupSummary): void {
    selectVehicle(setup.vehicleId);
    setTargetVehicleId(setup.vehicleId);
    setSearchParams({ setupId: setup.id }, { replace: true });
  }

  function startNewSheet(): void {
    const nextVehicleId = chassisId || undefined;
    initNewSetup(nextVehicleId);
    if (searchParams.has('setupId')) {
      setSearchParams({}, { replace: true });
    }
  }

  async function changeChassis(vehicleId: string): Promise<void> {
    const generation = ++chassisSwitchGeneration.current;
    selectVehicle(vehicleId);
    setScope('chassis');
    const loaded = await activateChassis(vehicleId);
    if (generation !== chassisSwitchGeneration.current) {
      return;
    }
    if (loaded) {
      setSearchParams({ setupId: loaded.id }, { replace: true });
      return;
    }
    if (searchParams.has('setupId')) {
      setSearchParams({}, { replace: true });
    }
  }

  const emptyCopy =
    scope === 'account'
      ? 'No setup sheets stamped in this garage yet.'
      : 'No setup sheets stamped for this chassis yet.';

  return (
    <div className="mb-4 border border-metal-border bg-pit-grease px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="flex gap-1 border-b border-metal-border"
            role="tablist"
            aria-label="Setup sheet browser scope"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'chassis'}
              onClick={() => setScope('chassis')}
              className={`border-b-2 px-3 py-1 font-display text-xs uppercase tracking-wider transition ${
                scope === 'chassis'
                  ? 'border-hazard-orange font-bold text-hazard-orange'
                  : 'border-transparent text-readout-dim hover:text-readout-bright'
              }`}
            >
              This Chassis
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'account'}
              onClick={() => setScope('account')}
              className={`border-b-2 px-3 py-1 font-display text-xs uppercase tracking-wider transition ${
                scope === 'account'
                  ? 'border-hazard-orange font-bold text-hazard-orange'
                  : 'border-transparent text-readout-dim hover:text-readout-bright'
              }`}
            >
              All My Sheets
            </button>
          </div>

          <label className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-readout-muted">
              Active Chassis:
            </span>
            <select
              aria-label="Active chassis"
              value={chassisId}
              onChange={(event) => {
                void changeChassis(event.target.value);
              }}
              className="border border-metal-border bg-pit-black px-2.5 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} ({vehicle.make} {vehicle.model})
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={startNewSheet}
          className="font-mono text-xs uppercase tracking-wider text-hazard-orange hover:underline"
        >
          + New Setup Sheet
        </button>
      </div>

      <div className="mt-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
          Inspect Sheet
          {isLoadingSheets ? '' : ` · ${sheets.length}`}
        </p>

        {isLoadingSheets ? (
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-readout-dim">
            Querying stamped sheets…
          </p>
        ) : sheets.length > 0 ? (
          <ul className="mt-2 flex list-none flex-wrap gap-2 p-0" aria-label="Garage setup sheets">
            {sheets.map((setup) => {
              const chassis = vehicles.find((vehicle) => vehicle.id === setup.vehicleId);
              const isActive = activeSetup?.id === setup.id;
              return (
                <li key={setup.id}>
                  <button
                    type="button"
                    onClick={() => inspectSheet(setup)}
                    className={`max-w-xs border px-2.5 py-1.5 text-left transition ${
                      isActive
                        ? 'border-hazard-orange bg-pit-black text-hazard-orange'
                        : 'border-metal-border bg-pit-black/60 text-readout-dim hover:text-readout-bright'
                    }`}
                  >
                    <span className="block truncate font-display text-xs font-bold uppercase tracking-wider">
                      {setup.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-readout-muted">
                      {scope === 'account' && chassis
                        ? `${chassis.name} · FDR ${setup.calculatedFdr.toFixed(2)}:1`
                        : `FDR ${setup.calculatedFdr.toFixed(2)}:1`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 font-mono text-xs text-readout-muted">{emptyCopy}</p>
        )}
      </div>
    </div>
  );
}
