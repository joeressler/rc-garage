import { MOTOR_TYPES } from '../../api/setups-constants';
import type { MotorType } from '../../api/setups';
import type { ChassisElectronics, VehicleDraft, VehicleFormErrors } from '../../api/vehicles';
import { RADIO_BOX_SLOTS, type RadioBoxSlotKey } from '../../api/vehicles';

interface ChassisElectronicsFieldsProps {
  values: VehicleDraft;
  errors: VehicleFormErrors;
  disabled?: boolean;
  onChange: (values: VehicleDraft) => void;
}

/**
 * Purpose: collect chassis radio-box part names and optional shop URLs shared by add/edit bay modals.
 */
export function ChassisElectronicsFields({
  values,
  errors,
  disabled = false,
  onChange,
}: ChassisElectronicsFieldsProps) {
  const electronics = values.electronics ?? {};

  function patchSlot(key: RadioBoxSlotKey, patch: Record<string, unknown>): void {
    onChange({
      ...values,
      electronics: {
        ...electronics,
        [key]: {
          ...electronics[key],
          ...patch,
        },
      },
    });
  }

  return (
    <fieldset className="space-y-4 border border-metal-border bg-pit-black/40 p-3">
      <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.28em] text-neon-radio">
        Radio Box · Electronics
      </legend>
      <p className="font-mono text-[11px] text-readout-dim">
        Stamped on this chassis for every sheet. Product links become inspect hyperlinks.
      </p>

      {RADIO_BOX_SLOTS.map((slot) => (
        <ElectronicsSlotRow
          key={slot.key}
          label={slot.label}
          slotKey={slot.key}
          electronics={electronics}
          errors={errors}
          disabled={disabled}
          onPatch={(patch) => patchSlot(slot.key, patch)}
        />
      ))}
    </fieldset>
  );
}

function ElectronicsSlotRow({
  label,
  slotKey,
  electronics,
  errors,
  disabled,
  onPatch,
}: {
  label: string;
  slotKey: RadioBoxSlotKey;
  electronics: ChassisElectronics;
  errors: VehicleFormErrors;
  disabled: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const component = electronics[slotKey];
  const nameError = errors[`electronics.${slotKey}.name`];
  const urlError = errors[`electronics.${slotKey}.productUrl`];
  const kvError = errors['electronics.motor.kv'];
  const cellError = errors['electronics.battery.cellCount'];
  const torqueError = errors['electronics.steeringServo.torqueKg'];

  return (
    <div className="space-y-2 border border-metal-border bg-pit-grease p-3">
      <p className="font-display text-sm uppercase tracking-wide text-readout-bright">{label}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field
          label="Part name"
          ariaLabel={`${label} name`}
          error={nameError}
          disabled={disabled}
          value={component?.name ?? ''}
          maxLength={80}
          onChange={(name) => onPatch({ name })}
        />
        <Field
          label="Product URL"
          ariaLabel={`${label} product URL`}
          error={urlError}
          disabled={disabled}
          value={component?.productUrl ?? ''}
          maxLength={500}
          placeholder="https://"
          onChange={(productUrl) => onPatch({ productUrl })}
        />
      </div>

      {slotKey === 'motor' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Motor type
            </span>
            <select
              aria-label="Motor type"
              value={electronics.motor?.motorType ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onPatch({
                  motorType: event.target.value === '' ? undefined : (event.target.value as MotorType),
                })
              }
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
            >
              <option value="">Unset</option>
              {MOTOR_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Motor kV"
            ariaLabel="Motor kV"
            error={kvError}
            disabled={disabled}
            value={electronics.motor?.kv != null ? String(electronics.motor.kv) : ''}
            inputMode="numeric"
            onChange={(raw) => onPatch({ kv: raw === '' ? undefined : Number(raw) })}
          />
        </div>
      ) : null}

      {slotKey === 'battery' ? (
        <Field
          label="Cell count"
          ariaLabel="Battery cell count"
          error={cellError}
          disabled={disabled}
          value={
            electronics.battery?.cellCount != null ? String(electronics.battery.cellCount) : ''
          }
          inputMode="numeric"
          onChange={(raw) => onPatch({ cellCount: raw === '' ? undefined : Number(raw) })}
        />
      ) : null}

      {slotKey === 'steeringServo' ? (
        <Field
          label="Torque (kg·cm)"
          ariaLabel="Steering servo torque kg"
          error={torqueError}
          disabled={disabled}
          value={
            electronics.steeringServo?.torqueKg != null
              ? String(electronics.steeringServo.torqueKg)
              : ''
          }
          inputMode="decimal"
          onChange={(raw) => onPatch({ torqueKg: raw === '' ? undefined : Number(raw) })}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  ariaLabel,
  value,
  error,
  disabled,
  maxLength,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  error?: string;
  disabled: boolean;
  maxLength?: number;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal';
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
        {label}
      </span>
      <input
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
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
