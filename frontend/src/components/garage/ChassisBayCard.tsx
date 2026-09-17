import { formatChassisStencil } from '../../lib/vehicle-labels';
import type { Vehicle } from '../../stores/useGarageStore';

interface ChassisBayCardProps {
  vehicle: Vehicle;
  isActive: boolean;
  onSelect: (vehicleId: string) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
}

/**
 * Purpose: render one chassis bay with stencil class, setup count, and workbench actions.
 */
export function ChassisBayCard({
  vehicle,
  isActive,
  onSelect,
  onEdit,
  onDelete,
}: ChassisBayCardProps) {
  const setupLabel = vehicle.setupCount === 1 ? '1 SETUP SHEET' : `${vehicle.setupCount} SETUP SHEETS`;

  return (
    <article className="chassis-tread-border">
      <div
        className={`relative border bg-pit-steel p-4 shadow-beveled-panel ${
          isActive ? 'border-neon-radio shadow-neon-glow' : 'border-pit-rubber'
        }`}
      >
        <span className="hex-rivet left-2 top-2" />
        <span className="hex-rivet right-2 top-2" />
        <span className="hex-rivet bottom-2 left-2" />
        <span className="hex-rivet bottom-2 right-2" />

        <p className="font-display text-[11px] uppercase tracking-[0.22em] text-hazard-orange">
          {formatChassisStencil(vehicle.vehicleClass, vehicle.scale)}
        </p>
        <h2 className="mt-2 font-display text-2xl uppercase leading-none text-readout-bright">
          {vehicle.name}
        </h2>
        <p className="mt-2 font-mono text-sm text-readout-dim">
          {vehicle.make} {vehicle.model}
        </p>

        {isActive ? (
          <p className="mt-3 inline-block border border-neon-radio px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-neon-radio">
            On the workbench
          </p>
        ) : null}

        <p className="mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-readout-dim">
          <WrenchIcon />
          {setupLabel}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => onSelect(vehicle.id)}
            className="bg-hazard-orange px-3 py-2 font-display text-xs uppercase tracking-[0.18em] text-pit-black shadow-hazard-glow"
          >
            Select for Workbench
          </button>
          <button
            type="button"
            onClick={() => onEdit(vehicle)}
            className="border border-metal-border bg-pit-black px-3 py-2 font-display text-xs uppercase tracking-[0.18em] text-readout-dim transition hover:border-hazard-orange hover:text-hazard-orange"
          >
            Edit Chassis
          </button>
          <button
            type="button"
            onClick={() => onDelete(vehicle)}
            className="border border-hazard-stripe px-3 py-2 font-display text-xs uppercase tracking-[0.18em] text-hazard-orange"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function WrenchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-nitromethane"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z"
      />
    </svg>
  );
}
