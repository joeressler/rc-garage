import type { Vehicle } from '../../stores/useGarageStore';
import { ChassisBayCard } from './ChassisBayCard';

interface ChassisRackGridProps {
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  onSelect: (vehicleId: string) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
}

/**
 * Purpose: lay out chassis bays on a responsive pit-rack grid.
 */
export function ChassisRackGrid({
  vehicles,
  activeVehicleId,
  onSelect,
  onEdit,
  onDelete,
}: ChassisRackGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle) => (
        <ChassisBayCard
          key={vehicle.id}
          vehicle={vehicle}
          isActive={vehicle.id === activeVehicleId}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
