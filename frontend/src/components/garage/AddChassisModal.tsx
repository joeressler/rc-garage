import { FormEvent, useEffect, useState } from 'react';
import {
  CreateVehicleSchema,
  EMPTY_VEHICLE_DRAFT,
  vehicleFormErrors,
  type VehicleDraft,
  type VehicleFormErrors,
} from '../../api/vehicles';
import { useGarageStore } from '../../stores/useGarageStore';
import { ChassisElectronicsFields } from './ChassisElectronicsFields';
import { ChassisSpecFields } from './ChassisSpecFields';

interface AddChassisModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Purpose: register a new chassis bay with Zod-validated pit-mat identity fields.
 */
export function AddChassisModal({ open, onClose }: AddChassisModalProps) {
  const createVehicle = useGarageStore((state) => state.createVehicle);
  const [values, setValues] = useState<VehicleDraft>(EMPTY_VEHICLE_DRAFT);
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(EMPTY_VEHICLE_DRAFT);
      setErrors({});
      setSubmitError(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = CreateVehicleSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(vehicleFormErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createVehicle(parsed.data);
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to register chassis.');
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
        aria-labelledby="add-chassis-title"
        className="knurled-aluminum relative max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 shadow-beveled-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="hex-rivet left-2 top-2" />
        <span className="hex-rivet right-2 top-2" />
        <span className="hex-rivet bottom-2 left-2" />
        <span className="hex-rivet bottom-2 right-2" />

        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-hazard-orange">
          Chassis intake
        </p>
        <h2
          id="add-chassis-title"
          className="mt-1 font-display text-3xl uppercase tracking-wide text-readout-bright"
        >
          Add New Chassis
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
          <ChassisElectronicsFields
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
            {isSubmitting ? 'Stamping bay…' : 'Register chassis'}
          </button>
        </form>
      </div>
    </div>
  );
}
