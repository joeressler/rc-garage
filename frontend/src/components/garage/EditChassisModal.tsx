import { FormEvent, useEffect, useState } from 'react';
import {
  CreateVehicleSchema,
  EMPTY_VEHICLE_DRAFT,
  vehicleFormErrors,
  type VehicleDraft,
} from '../../api/vehicles';
import { useGarageStore, type Vehicle } from '../../stores/useGarageStore';
import { ChassisSpecFields } from './ChassisSpecFields';

interface EditChassisModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

/**
 * Purpose: revise an existing chassis bay identity without leaving the fleet rack.
 */
export function EditChassisModal({ vehicle, onClose }: EditChassisModalProps) {
  const updateVehicle = useGarageStore((state) => state.updateVehicle);
  const [values, setValues] = useState<VehicleDraft>(EMPTY_VEHICLE_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleDraft, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setValues({
        name: vehicle.name,
        make: vehicle.make,
        model: vehicle.model,
        scale: vehicle.scale,
        vehicleClass: vehicle.vehicleClass,
      });
      setErrors({});
      setSubmitError(null);
    }
  }, [vehicle]);

  if (!vehicle) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!vehicle) {
      return;
    }

    const parsed = CreateVehicleSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(vehicleFormErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await updateVehicle(vehicle.id, parsed.data);
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to update chassis.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/80 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-chassis-title"
        className="knurled-aluminum relative w-full max-w-md p-6 shadow-beveled-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="hex-rivet left-2 top-2" />
        <span className="hex-rivet right-2 top-2" />
        <span className="hex-rivet bottom-2 left-2" />
        <span className="hex-rivet bottom-2 right-2" />

        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-nitromethane">
          Bay service
        </p>
        <h2
          id="edit-chassis-title"
          className="mt-1 font-display text-3xl uppercase tracking-wide text-readout-bright"
        >
          Edit Chassis
        </h2>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <ChassisSpecFields
            values={values}
            errors={errors}
            disabled={isSubmitting}
            onChange={(next) => {
              setValues(next);
              setErrors({});
            }}
          />

          {submitError ? (
            <p className="border border-hazard-stripe bg-pit-black px-3 py-2 font-mono text-xs text-hazard-orange">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-hazard-orange py-2 font-display text-sm uppercase tracking-[0.24em] text-pit-black shadow-hazard-glow disabled:opacity-60"
          >
            {isSubmitting ? 'Updating bay…' : 'Save chassis spec'}
          </button>
        </form>
      </div>
    </div>
  );
}
