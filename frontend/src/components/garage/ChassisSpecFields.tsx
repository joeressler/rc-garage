import type { VehicleDraft, VehicleFormErrors } from '../../api/vehicles';
import { VEHICLE_CLASSES, VEHICLE_SCALES } from '../../api/vehicles';
import { VEHICLE_CLASS_LABELS } from '../../lib/vehicle-labels';

interface ChassisSpecFieldsProps {
  values: VehicleDraft;
  errors: VehicleFormErrors;
  disabled?: boolean;
  onChange: (values: VehicleDraft) => void;
}

/**
 * Purpose: collect chassis identity fields shared by add and edit bay modals.
 */
export function ChassisSpecFields({
  values,
  errors,
  disabled = false,
  onChange,
}: ChassisSpecFieldsProps) {
  return (
    <div className="space-y-3">
      <Field
        label="Bay name"
        error={errors.name}
        disabled={disabled}
        value={values.name}
        maxLength={60}
        onChange={(name) => onChange({ ...values, name })}
      />
      <Field
        label="Make"
        error={errors.make}
        disabled={disabled}
        value={values.make}
        maxLength={50}
        onChange={(make) => onChange({ ...values, make })}
      />
      <Field
        label="Model"
        error={errors.model}
        disabled={disabled}
        value={values.model}
        maxLength={50}
        onChange={(model) => onChange({ ...values, model })}
      />
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
          Scale
        </span>
        <select
          value={values.scale}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...values, scale: event.target.value as VehicleDraft['scale'] })
          }
          className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
        >
          {VEHICLE_SCALES.map((scale) => (
            <option key={scale} value={scale}>
              {scale}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
          Class
        </span>
        <select
          value={values.vehicleClass}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...values,
              vehicleClass: event.target.value as VehicleDraft['vehicleClass'],
            })
          }
          className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
        >
          {VEHICLE_CLASSES.map((vehicleClass) => (
            <option key={vehicleClass} value={vehicleClass}>
              {VEHICLE_CLASS_LABELS[vehicleClass]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Field({
  label,
  value,
  error,
  disabled,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
        {label}
      </span>
      <input
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange ${
          error ? 'border-hazard-stripe' : 'border-metal-border'
        }`}
      />
      {error ? (
        <span className="mt-1 block font-mono text-[11px] text-hazard-orange">{error}</span>
      ) : null}
    </label>
  );
}
