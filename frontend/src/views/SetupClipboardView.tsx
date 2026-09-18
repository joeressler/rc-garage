import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGetSetup } from '../api/setups';
import { ForkDiffInspectorModal } from '../components/diff/ForkDiffInspectorModal';
import { QrPitStickerPrinterModal } from '../components/qr/QrPitStickerPrinterModal';
import { ClipboardActionBar } from '../components/setup/ClipboardActionBar';
import { ClipboardHeaderClamp } from '../components/setup/ClipboardHeaderClamp';
import { ClipboardSetupSwitcher } from '../components/setup/ClipboardSetupSwitcher';
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
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const userId = useAuthStore((state) => state.user?.id);
  const vehicles = useGarageStore((state) => state.vehicles);
  const activeVehicleId = useGarageStore((state) => state.activeVehicleId);

  const activeSetup = useSetupStore((state) => state.activeSetup);
  const activeSettings = useSetupStore((state) => state.activeSettings);
  const comparisonParentSetup = useSetupStore((state) => state.comparisonParentSetup);
  const targetVehicleId = useSetupStore((state) => state.targetVehicleId);
  const isLoading = useSetupStore((state) => state.isLoading);
  const initNewSetup = useSetupStore((state) => state.initNewSetup);
  const loadSetupById = useSetupStore((state) => state.loadSetupById);

  const [printQrOpen, setPrintQrOpen] = useState(false);
  const [diffInspectorOpen, setDiffInspectorOpen] = useState(false);

  // Load owned sheets only; foreign ids belong on the community inspect overlay.
  useEffect(() => {
    if (!setupIdParam || isAuthLoading) {
      return;
    }
    if (!isAuthenticated) {
      navigate(`/feed?inspect=${encodeURIComponent(setupIdParam)}`, { replace: true });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const token = useAuthStore.getState().token;
        const setup = await apiGetSetup(setupIdParam, token);
        if (cancelled) {
          return;
        }
        if (userId && setup.userId !== userId) {
          navigate(`/feed?inspect=${encodeURIComponent(setup.id)}`, { replace: true });
          return;
        }
        await loadSetupById(setupIdParam);
      } catch {
        if (!cancelled) {
          await loadSetupById(setupIdParam);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    setupIdParam,
    isAuthenticated,
    isAuthLoading,
    userId,
    loadSetupById,
    navigate,
  ]);

  // Sync target vehicle with garage store if creating new
  useEffect(() => {
    if (setupIdParam || activeSetup || isLoading) {
      return;
    }
    if (activeVehicleId && (!targetVehicleId || targetVehicleId !== activeVehicleId)) {
      initNewSetup(activeVehicleId);
    }
  }, [setupIdParam, activeSetup, isLoading, activeVehicleId, targetVehicleId, initNewSetup]);

  const activeChassis = vehicles.find((v) => v.id === (targetVehicleId ?? activeSetup?.vehicleId));

  return (
    <section className="relative pb-12">
      {vehicles.length > 0 ? <ClipboardSetupSwitcher /> : null}

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
        <ClipboardHeaderClamp onInspectParentDiff={() => setDiffInspectorOpen(true)} />

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
        <QrPitStickerPrinterModal
          open={printQrOpen}
          onClose={() => setPrintQrOpen(false)}
          chassisName={activeChassis ? `${activeChassis.make} ${activeChassis.model}` : 'RC Chassis'}
          calculatedFdr={activeSetup.calculatedFdr}
          qrSlug={activeSetup.qrSlug}
          setupId={activeSetup.id}
          setupTitle={activeSetup.title}
        />
      ) : null}

      {/* Fork Diff Inspector Modal */}
      <ForkDiffInspectorModal
        open={diffInspectorOpen}
        onClose={() => setDiffInspectorOpen(false)}
        parentSettings={comparisonParentSetup}
        currentSettings={activeSettings}
        currentTitle={activeSetup?.title ?? 'Active Fork'}
      />
    </section>
  );
}
