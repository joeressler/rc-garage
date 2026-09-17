import { useEffect, useState } from 'react';
import { AddChassisModal } from '../components/garage/AddChassisModal';
import { ChassisRackGrid } from '../components/garage/ChassisRackGrid';
import { EditChassisModal } from '../components/garage/EditChassisModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore, type Vehicle } from '../stores/useGarageStore';

interface GarageFleetViewProps {
  onRequestAuth: () => void;
}

/**
 * Purpose: host the driver's chassis rack, empty-bay onboarding, and fleet mutations.
 */
export function GarageFleetView({ onRequestAuth }: GarageFleetViewProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const vehicles = useGarageStore((state) => state.vehicles);
  const activeVehicleId = useGarageStore((state) => state.activeVehicleId);
  const isLoading = useGarageStore((state) => state.isLoading);
  const error = useGarageStore((state) => state.error);
  const fetchVehicles = useGarageStore((state) => state.fetchVehicles);
  const selectVehicle = useGarageStore((state) => state.selectVehicle);
  const deleteVehicle = useGarageStore((state) => state.deleteVehicle);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchVehicles();
    }
  }, [isAuthenticated, fetchVehicles]);

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteVehicle(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section>
      <header className="mb-8 space-y-3 border-b border-metal-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-nitromethane">
              Drawer 01 · Fleet Garage
            </p>
            <h1 className="mt-1 font-display text-4xl uppercase tracking-wide text-readout-bright">
              Chassis Rack
            </h1>
          </div>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="shrink-0 bg-hazard-orange px-4 py-2 font-display text-sm uppercase tracking-[0.2em] text-pit-black shadow-hazard-glow"
            >
              Add New Chassis
            </button>
          ) : (
            <button
              type="button"
              onClick={onRequestAuth}
              className="shrink-0 bg-hazard-orange px-4 py-2 font-display text-sm uppercase tracking-[0.2em] text-pit-black shadow-hazard-glow"
            >
              Login to register chassis
            </button>
          )}
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-readout-dim">
          <span className="border border-metal-border bg-pit-black px-2 py-1 text-readout-bright">
            {vehicles.length} {vehicles.length === 1 ? 'VEHICLE' : 'VEHICLES'}
          </span>
        </p>
      </header>

      {error ? (
        <p className="mb-4 border border-hazard-stripe bg-pit-black px-3 py-2 font-mono text-xs text-hazard-orange">
          {error}
        </p>
      ) : null}

      {isAuthenticated && isLoading && vehicles.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-readout-dim">
          Scanning chassis bays…
        </p>
      ) : null}

      {!isAuthenticated ? (
        <EmptyRack
          title="Rack sealed"
          body="Sign in to pull your fleet onto the chassis rack and register the first bay."
          actionLabel="Open scrutineering gate"
          onAction={onRequestAuth}
        />
      ) : null}

      {isAuthenticated && !isLoading && vehicles.length === 0 ? (
        <EmptyRack
          title="Empty chassis rack"
          body="No bays stamped yet. Register the first vehicle to start logging setup sheets."
          actionLabel="Register the first vehicle"
          onAction={() => setAddOpen(true)}
        />
      ) : null}

      {isAuthenticated && vehicles.length > 0 ? (
        <ChassisRackGrid
          vehicles={vehicles}
          activeVehicleId={activeVehicleId}
          onSelect={selectVehicle}
          onEdit={setEditing}
          onDelete={setPendingDelete}
        />
      ) : null}

      <AddChassisModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditChassisModal vehicle={editing} onClose={() => setEditing(null)} />

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/80 px-4"
          role="presentation"
          onClick={() => (isDeleting ? undefined : setPendingDelete(null))}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-chassis-title"
            className="relative w-full max-w-md border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="hex-rivet left-2 top-2" />
            <span className="hex-rivet right-2 top-2" />
            <h2
              id="delete-chassis-title"
              className="font-display text-3xl uppercase text-readout-bright"
            >
              Scrap this chassis?
            </h2>
            <p className="mt-3 text-sm text-readout-dim">
              Remove <span className="text-readout-bright">{pendingDelete.name}</span> from the
              rack. Public setup lineage stays on the board; private sheets on this bay are
              dropped.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void confirmDelete()}
                className="bg-hazard-orange px-4 py-2 font-display text-xs uppercase tracking-[0.18em] text-pit-black disabled:opacity-60"
              >
                {isDeleting ? 'Pulling bay…' : 'Delete chassis'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDelete(null)}
                className="border border-metal-border px-4 py-2 font-display text-xs uppercase tracking-[0.18em] text-readout-dim"
              >
                Keep on the rack
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EmptyRack({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="relative overflow-hidden border-t-2 border-l-2 border-pit-rubber bg-pit-steel/90 p-6 shadow-beveled-panel">
      <span className="hex-rivet left-3 top-3" />
      <span className="hex-rivet right-3 top-3" />
      <span className="hex-rivet bottom-3 left-3" />
      <span className="hex-rivet bottom-3 right-3" />
      <h2 className="font-display text-3xl uppercase text-readout-bright">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-readout-dim">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 bg-hazard-orange px-4 py-2 font-display text-sm uppercase tracking-[0.2em] text-pit-black shadow-hazard-glow"
      >
        {actionLabel}
      </button>
    </div>
  );
}
