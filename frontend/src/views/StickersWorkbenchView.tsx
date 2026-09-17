import { useEffect, useState } from 'react';
import { apiListSetups, type SetupSummary } from '../api/setups';
import { QrPitStickerPrinterModal } from '../components/qr/QrPitStickerPrinterModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore } from '../stores/useGarageStore';

interface StickersWorkbenchViewProps {
  onRequestAuth: () => void;
}

/**
 * Purpose: render the QR Pit-Stickers workbench allowing drivers to pick any vehicle and setup sheet to preview and print chassis stickers.
 */
export function StickersWorkbenchView({ onRequestAuth }: StickersWorkbenchViewProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const vehicles = useGarageStore((state) => state.vehicles);
  const activeVehicleId = useGarageStore((state) => state.activeVehicleId);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [setups, setSetups] = useState<SetupSummary[]>([]);
  const [selectedSetup, setSelectedSetup] = useState<SetupSummary | null>(null);
  const [isLoadingSetups, setIsLoadingSetups] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Set default vehicle
  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(activeVehicleId ?? vehicles[0]?.id ?? '');
    }
  }, [vehicles, activeVehicleId, selectedVehicleId]);

  // Load setups when selected vehicle changes
  useEffect(() => {
    if (!selectedVehicleId || !token) {
      setSetups([]);
      return;
    }

    let cancelled = false;
    setIsLoadingSetups(true);

    apiListSetups(token, selectedVehicleId)
      .then((data) => {
        if (!cancelled) {
          setSetups(data);
          if (data.length > 0) {
            setSelectedSetup(data[0] ?? null);
          } else {
            setSelectedSetup(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSetups([]);
          setSelectedSetup(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSetups(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId, token]);

  const activeChassis = vehicles.find((v) => v.id === selectedVehicleId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Workbench Header */}
      <div className="mb-8 border-b-2 border-pit-rubber pb-4">
        <div className="flex items-center gap-2">
          <span className="border border-hazard-orange bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-hazard-orange">
            Drawer 04
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-readout-dim">
            Chassis Identification Bay
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wider text-readout-bright">
          QR Pit-Sticker Printing Matrix
        </h1>
        <p className="mt-1 font-mono text-xs text-readout-muted">
          Print standard 1.5" x 1.5" high-contrast vinyl chassis tags with Level H Error Correction for pit inspection.
        </p>
      </div>

      {!isAuthenticated ? (
        <div className="border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-8 shadow-beveled-panel text-center">
          <h2 className="font-display text-xl uppercase text-readout-bright">
            Driver Authentication Required
          </h2>
          <p className="mt-2 font-mono text-xs text-readout-dim">
            Sign in to access your garage vehicles and generate official chassis stickers.
          </p>
          <button
            type="button"
            onClick={onRequestAuth}
            className="mt-4 border border-hazard-orange bg-hazard-orange px-6 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-pit-black hover:bg-hazard-orange/90"
          >
            Authenticate Driver
          </button>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="border border-metal-border bg-pit-steel p-8 text-center">
          <p className="font-mono text-xs text-readout-muted">
            No vehicles in your garage rack. Create a chassis first in Fleet Garage.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Left Column: Vehicle & Setup Picker */}
          <div className="space-y-6 md:col-span-1">
            {/* Vehicle Selection */}
            <div className="border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-4 shadow-beveled-panel">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-widest text-hazard-orange">
                  1. Select Chassis Bay
                </span>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="mt-2 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.make} {v.model})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Setup Selection */}
            <div className="border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-4 shadow-beveled-panel">
              <span className="block font-mono text-[10px] uppercase tracking-widest text-hazard-orange">
                2. Select Stamped Setup Sheet
              </span>

              {isLoadingSetups ? (
                <p className="mt-3 font-mono text-xs text-readout-dim animate-pulse">
                  Querying setup sheets…
                </p>
              ) : setups.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {setups.map((setup) => (
                    <button
                      key={setup.id}
                      type="button"
                      onClick={() => setSelectedSetup(setup)}
                      className={`w-full text-left border p-2.5 transition ${
                        selectedSetup?.id === setup.id
                          ? 'border-hazard-orange bg-pit-black text-hazard-orange'
                          : 'border-metal-border bg-pit-black/50 text-readout-dim hover:text-readout-bright'
                      }`}
                    >
                      <p className="font-display text-xs font-bold uppercase tracking-wider truncate">
                        {setup.title}
                      </p>
                      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-readout-muted">
                        <span>FDR: {setup.calculatedFdr.toFixed(2)}:1</span>
                        <span>/s/{setup.qrSlug}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 font-mono text-xs text-readout-muted">
                  No setup sheets stamped for this chassis yet. Create one in Setup Clipboard.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Preview & Action Launch */}
          <div className="md:col-span-2">
            {selectedSetup && activeChassis ? (
              <div className="border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel">
                <div className="flex items-center justify-between border-b border-metal-border pb-3">
                  <h3 className="font-display text-lg font-bold uppercase tracking-wider text-readout-bright">
                    Chassis Tag Preview & Export Bay
                  </h3>
                  <span className="border border-neon-radio/50 bg-pit-black px-2 py-0.5 font-mono text-[10px] text-neon-radio">
                    300 DPI READY
                  </span>
                </div>

                <div className="mt-6 flex flex-col items-center justify-center border border-metal-border bg-pit-black p-8">
                  <p className="mb-4 font-mono text-xs uppercase tracking-widest text-readout-dim">
                    {activeChassis.make} {activeChassis.model} — {selectedSetup.title}
                  </p>
                  <div className="border border-white/20 p-2 bg-white/5">
                    {/* Render static preview */}
                    <div
                      className="chassis-sticker-printer flex flex-col justify-between bg-white p-[0.08in] text-black"
                      style={{ width: '1.5in', height: '1.5in' }}
                    >
                      <header className="text-center font-display text-[9px] font-bold uppercase leading-tight tracking-wide">
                        {activeChassis.make} {activeChassis.model}
                      </header>
                      <div className="mx-auto flex h-[0.92in] w-[0.92in] items-center justify-center bg-white">
                        <img
                          src={`/api/garage/setups/${encodeURIComponent(selectedSetup.id)}/qr?format=svg&size=450`}
                          alt={`QR for ${selectedSetup.qrSlug}`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <footer className="text-center font-mono text-[7px] leading-tight">
                        <p>FDR: {selectedSetup.calculatedFdr.toFixed(2)}:1</p>
                        <p>/s/{selectedSetup.qrSlug}</p>
                      </footer>
                    </div>
                  </div>
                  <span className="mt-4 font-mono text-[10px] text-readout-muted">
                    Ready for 1.5" x 1.5" thermal / vinyl continuous label printing
                  </span>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="border border-hazard-orange bg-hazard-orange px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-pit-black hover:bg-hazard-orange/90 shadow-hazard-glow"
                  >
                    Open Print & Export Workbench
                  </button>
                </div>

                {/* Sticker Modal */}
                <QrPitStickerPrinterModal
                  open={modalOpen}
                  onClose={() => setModalOpen(false)}
                  chassisName={`${activeChassis.make} ${activeChassis.model}`}
                  calculatedFdr={selectedSetup.calculatedFdr}
                  qrSlug={selectedSetup.qrSlug}
                  setupId={selectedSetup.id}
                  setupTitle={selectedSetup.title}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center border border-metal-border bg-pit-steel p-6">
                <p className="font-mono text-xs uppercase tracking-wider text-readout-muted">
                  Select a chassis and setup sheet to configure sticker exports.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
