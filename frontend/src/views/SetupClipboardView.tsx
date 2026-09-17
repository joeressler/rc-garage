import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChassisStickerPrinter } from '../components/qr/ChassisStickerPrinter';
import { ClipboardActionBar } from '../components/setup/ClipboardActionBar';
import { ClipboardHeaderClamp } from '../components/setup/ClipboardHeaderClamp';
import { DrivetrainToolboxCard } from '../components/setup/DrivetrainToolboxCard';
import { SuspensionDynoCard } from '../components/setup/SuspensionDynoCard';
import { TireAndBalanceToolboxCard } from '../components/setup/TireAndBalanceToolboxCard';
import { TrackEnvironmentNotesCard } from '../components/setup/TrackEnvironmentNotesCard';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore } from '../stores/useGarageStore';
import { useSetupStore } from '../stores/useSetupStore';

interface SetupClipboardViewProps {
  onRequestAuth: () => void;
}

/**
 * Purpose: host the Setup Sheet Clipboard editor workbench, live telemetry cards, and QR printing modal.
 */
export function SetupClipboardView({ onRequestAuth }: SetupClipboardViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setupIdParam = searchParams.get('setupId');

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const vehicles = useGarageStore((state) => state.vehicles);
  const activeVehicleId = useGarageStore((state) => state.activeVehicleId);

  const activeSetup = useSetupStore((state) => state.activeSetup);
  const targetVehicleId = useSetupStore((state) => state.targetVehicleId);
  const isLoading = useSetupStore((state) => state.isLoading);
  const initNewSetup = useSetupStore((state) => state.initNewSetup);
  const loadSetupById = useSetupStore((state) => state.loadSetupById);
  const setTargetVehicleId = useSetupStore((state) => state.setTargetVehicleId);

  const [printQrOpen, setPrintQrOpen] = useState(false);

  // Load setup if query param exists
  useEffect(() => {
    if (setupIdParam) {
      void loadSetupById(setupIdParam);
    }
  }, [setupIdParam, loadSetupById]);

  // Sync target vehicle with garage store if creating new
  useEffect(() => {
    if (!setupIdParam && !activeSetup) {
      if (activeVehicleId && (!targetVehicleId || targetVehicleId !== activeVehicleId)) {
        initNewSetup(activeVehicleId);
      }
    }
  }, [setupIdParam, activeSetup, activeVehicleId, targetVehicleId, initNewSetup]);

  const activeChassis = vehicles.find((v) => v.id === (targetVehicleId ?? activeSetup?.vehicleId));

  return (
    <section className="relative pb-12">
      {/* Vehicle Selector bar if user has multiple chassis */}
      {vehicles.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-metal-border bg-pit-grease px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-readout-muted">
              Active Chassis:
            </span>
            <select
              value={targetVehicleId ?? activeVehicleId ?? ''}
              onChange={(e) => {
                const vid = e.target.value;
                setTargetVehicleId(vid);
              }}
              className="border border-metal-border bg-pit-black px-2.5 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.make} {v.model})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => initNewSetup(targetVehicleId ?? activeVehicleId ?? undefined)}
            className="font-mono text-xs uppercase tracking-wider text-hazard-orange hover:underline"
          >
            + New Setup Sheet
          </button>
        </div>
      ) : null}

      {/* Empty Fleet Warning */}
      {isAuthenticated && vehicles.length === 0 ? (
        <div className="mb-6 border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel">
          <h2 className="font-display text-2xl uppercase text-readout-bright">
            No Chassis On The Rack
          </h2>
          <p className="mt-2 text-sm text-readout-dim">
            You must register at least one vehicle in Fleet Garage before stamping and saving a setup sheet.
          </p>
          <button
            type="button"
            onClick={() => navigate('/garage')}
            className="mt-4 bg-hazard-orange px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-pit-black"
          >
            Go to Chassis Rack
          </button>
        </div>
      ) : null}

      {/* Main Clipboard Container */}
      <div className="relative">
        <ClipboardHeaderClamp />

        {isLoading ? (
          <div className="p-12 text-center font-mono text-xs uppercase tracking-widest text-readout-dim">
            Loading telemetry sheet…
          </div>
        ) : (
          <>
            {/* 2x2 Grid of Telemetry Toolbox Drawers */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DrivetrainToolboxCard />
              <TireAndBalanceToolboxCard />
              <SuspensionDynoCard />
              <TrackEnvironmentNotesCard />
            </div>

            <ClipboardActionBar
              isAuthenticated={isAuthenticated}
              onRequestAuth={onRequestAuth}
              onPrintQr={() => setPrintQrOpen(true)}
            />
          </>
        )}
      </div>

      {/* QR Code Sticker Preview Modal */}
      {printQrOpen && activeSetup?.qrSlug ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/80 px-4"
          role="presentation"
          onClick={() => setPrintQrOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-sticker-title"
            className="relative w-full max-w-sm border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="hex-rivet left-2 top-2" />
            <span className="hex-rivet right-2 top-2" />
            <h3
              id="qr-sticker-title"
              className="font-display text-2xl uppercase text-readout-bright"
            >
              Chassis Sticker Matrix
            </h3>
            <p className="mt-1 font-mono text-xs text-readout-dim">
              Standard 1.5" x 1.5" Vinyl Chassis Tag (Level H ECC)
            </p>

            <div className="mt-4 flex justify-center border border-metal-border bg-pit-black p-4">
              <ChassisStickerPrinter
                chassisName={activeChassis ? `${activeChassis.make} ${activeChassis.model}` : 'RC Chassis'}
                calculatedFdr={activeSetup.calculatedFdr}
                qrSlug={activeSetup.qrSlug}
                setupId={activeSetup.id}
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-hazard-orange py-2 font-display text-xs uppercase tracking-wider text-pit-black shadow-hazard-glow"
              >
                Print Sticker
              </button>
              <button
                type="button"
                onClick={() => setPrintQrOpen(false)}
                className="border border-metal-border px-4 py-2 font-display text-xs uppercase tracking-wider text-readout-dim"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
