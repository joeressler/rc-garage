import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../../api/http';
import {
  apiResolveInspection,
  type PublicInspectionVehicle,
} from '../../api/qr';
import {
  apiGetSetup,
  TRANSMISSION_PRESETS,
  type SetupEntity,
  type SetupSettings,
} from '../../api/setups';
import { FOAM_INSERTS, GRIP_LEVELS, MOTOR_TYPES, SURFACES } from '../../api/setups-constants';
import {
  electronicsHasSpec,
  isHttpProductUrl,
  RADIO_BOX_SLOTS,
  radioBoxSlotFilled,
  type ChassisElectronics,
  type ElectronicsComponent,
} from '../../api/vehicles';
import { formatFdr, formatShock, VEHICLE_CLASS_LABELS } from '../../lib/vehicle-labels';
import { useAuthStore } from '../../stores/useAuthStore';
import type { ForkToGarageSource } from './ForkToGarageModal';

interface SetupInspectOverlayProps {
  open: boolean;
  setupId?: string | null;
  slug?: string | null;
  authorCallsign?: string | null;
  onClose: () => void;
  onRequestFork: (source: ForkToGarageSource) => void;
}

/**
 * Purpose: inspect a foreign public setup over the community feed without writing the driver's clipboard editor.
 */
export function SetupInspectOverlay({
  open,
  setupId,
  slug,
  authorCallsign,
  onClose,
  onRequestFork,
}: SetupInspectOverlayProps) {
  const token = useAuthStore((state) => state.token);
  const [setup, setSetup] = useState<SetupEntity | null>(null);
  const [vehicle, setVehicle] = useState<PublicInspectionVehicle | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || (!setupId && !slug)) {
      return;
    }

    let cancelled = false;
    setSetup(null);
    setVehicle(null);
    setMissing(false);
    setLoadError(null);

    void (async () => {
      try {
        const loaded = slug
          ? await loadBySlug(slug, token)
          : await loadBySetupId(setupId as string, token);
        if (cancelled) {
          return;
        }
        setSetup(loaded.setup);
        setVehicle(loaded.vehicle);
      } catch (err: unknown) {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && err.statusCode === 404) {
          setMissing(true);
          return;
        }
        setLoadError('Unable to load chassis inspection sheet.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, setupId, slug, token]);

  if (!open) {
    return null;
  }

  const handleFork = () => {
    if (!setup) {
      return;
    }
    onRequestFork({
      id: setup.id,
      title: setup.title,
      authorCallsign: authorCallsign ?? undefined,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-inspect-title"
      data-testid="setup-inspect-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-pit-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-auto my-6 w-full max-w-5xl border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="hex-rivet left-2 top-2" />
        <span className="hex-rivet right-2 top-2" />

        {missing ? <MissingSheetCard slug={slug} onClose={onClose} /> : null}

        {loadError ? (
          <article className="space-y-4">
            <p className="font-mono text-sm text-hazard-orange">{loadError}</p>
            <BackToFeedButton onClose={onClose} />
          </article>
        ) : null}

        {!setup && !missing && !loadError ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-readout-dim">
              {slug ? 'Resolving chassis slug…' : 'Loading telemetry sheet…'}
            </p>
            <BackToFeedButton onClose={onClose} />
          </div>
        ) : null}

        {setup ? (
          <InspectedSheet
            setup={setup}
            vehicle={vehicle}
            authorCallsign={authorCallsign}
            onClose={onClose}
            onFork={handleFork}
          />
        ) : null}
      </div>
    </div>
  );
}

async function loadBySlug(
  slug: string,
  token?: string | null,
): Promise<{ setup: SetupEntity; vehicle: PublicInspectionVehicle | null }> {
  const sheet = await apiResolveInspection(slug);
  const setup = await apiGetSetup(sheet.setupId, token);
  return { setup, vehicle: sheet.vehicle };
}

async function loadBySetupId(
  setupId: string,
  token?: string | null,
): Promise<{ setup: SetupEntity; vehicle: PublicInspectionVehicle | null }> {
  const setup = await apiGetSetup(setupId, token);
  if (!setup.qrSlug) {
    return { setup, vehicle: null };
  }
  try {
    const sheet = await apiResolveInspection(setup.qrSlug);
    return { setup, vehicle: sheet.vehicle };
  } catch {
    return { setup, vehicle: null };
  }
}

function InspectedSheet({
  setup,
  vehicle,
  authorCallsign,
  onClose,
  onFork,
}: {
  setup: SetupEntity;
  vehicle: PublicInspectionVehicle | null;
  authorCallsign?: string | null;
  onClose: () => void;
  onFork: () => void;
}) {
  const classLabel = vehicle ? VEHICLE_CLASS_LABELS[vehicle.vehicleClass] : null;
  const settings = setup.settings;
  const drivetrain = settings.drivetrain;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-anodized-blue">
            Public pit inspection
          </p>
          <h1
            id="setup-inspect-title"
            className="mt-1 font-display text-3xl uppercase leading-none text-readout-bright"
          >
            {vehicle ? `${vehicle.make} ${vehicle.model}` : setup.title}
          </h1>
          {vehicle ? (
            <p className="mt-2 font-mono text-xs text-readout-dim">{vehicle.name}</p>
          ) : null}
          {authorCallsign ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-hazard-orange">
              @{authorCallsign}
            </p>
          ) : null}
          {vehicle ? (
            <p className="mt-3 font-display text-lg uppercase text-readout-bright">{setup.title}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {vehicle && classLabel ? (
            <span className="whitespace-nowrap border border-hazard-orange px-2 py-1 font-display text-[11px] uppercase tracking-widest text-hazard-orange">
              {vehicle.scale} · {classLabel}
            </span>
          ) : null}
          <span className="rotate-[-2deg] border-2 border-neon-radio px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.18em] text-neon-radio shadow-neon-glow">
            Verified scrutineering
          </span>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Readout label="FDR" value={formatFdr(setup.calculatedFdr)} accent />
        <Readout label="Battery" value={`${drivetrain.batteryCellCount}S`} />
        <Readout
          label="Front shock"
          value={formatShock(
            settings.suspension.front.oilViscosityValue,
            settings.suspension.front.oilViscosityUnit,
          )}
        />
        <Readout
          label="Rear shock"
          value={formatShock(
            settings.suspension.rear.oilViscosityValue,
            settings.suspension.rear.oilViscosityUnit,
          )}
        />
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReadoutDrawer
          kicker="Drawer A · Power & Transmission"
          title="Drivetrain & Gearing"
        >
          <Readout label="Pinion" value={`${drivetrain.pinionTeeth}T`} />
          <Readout label="Spur" value={`${drivetrain.spurTeeth}T`} />
          <Readout label="Internal ratio" value={formatInternalRatio(drivetrain.transmissionInternalRatio)} />
          <Readout label="FDR" value={formatFdr(drivetrain.calculatedFdr ?? setup.calculatedFdr)} accent />
          <Readout label="Gear pitch" value={drivetrain.gearPitch} />
          <Readout label="Motor" value={humanize(drivetrain.motorType)} />
          <Readout label="Motor kV" value={drivetrain.motorKv != null ? `${drivetrain.motorKv} kV` : '—'} />
          <Readout label="Under/overdrive" value={`${drivetrain.underdriveOverdrivePercentage}%`} />
        </ReadoutDrawer>

        <ReadoutDrawer kicker="Drawer B · Traction & Mass" title="Tires & Corner Balance">
          <TireReadout axle="Front" tire={settings.tiresAndWeight.front} />
          <TireReadout axle="Rear" tire={settings.tiresAndWeight.rear} />
          <Readout
            label="Front CoG"
            value={`${(settings.tiresAndWeight.weight.frontWeightBiasPercentage ?? setup.frontBiasPercentage).toFixed(1)}%`}
            accent
          />
          <Readout
            label="Ready-to-run"
            value={`${settings.tiresAndWeight.weight.totalRtrWeightGrams}g`}
          />
          <Readout
            label="Battery mount"
            value={humanize(settings.tiresAndWeight.weight.batteryMountLocation)}
          />
        </ReadoutDrawer>

        <ReadoutDrawer
          kicker="Drawer C · Geometry & Damping"
          title="Suspension & Shock Dyno Readouts"
        >
          <ShockReadout axle="Front" spec={settings.suspension.front} />
          <ShockReadout axle="Rear" spec={settings.suspension.rear} />
          <Readout
            label="Portal gears"
            value={settings.suspension.portalGearsInstalled ? 'Installed' : 'Not installed'}
          />
        </ReadoutDrawer>

        <ReadoutDrawer
          kicker="Drawer D · Trail Environment"
          title="Track Conditions & Driver Notes"
        >
          <Readout label="Surface" value={labelFrom(SURFACES, settings.trackConditions.surface)} />
          <Readout label="Grip" value={labelFrom(GRIP_LEVELS, settings.trackConditions.grip)} />
          <Readout
            label="Ambient"
            value={
              settings.trackConditions.ambientTempCelsius != null
                ? `${settings.trackConditions.ambientTempCelsius}°C`
                : '—'
            }
          />
          <Readout label="Location" value={settings.trackConditions.locationTag || setup.locationTag || '—'} />
          <div className="col-span-full border border-metal-border bg-pit-black px-3 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
              Driver notes
            </dt>
            <dd className="mt-1 font-mono text-xs text-readout-bright">
              {settings.driverNotes?.trim() || setup.description || 'No trail notes stamped.'}
            </dd>
          </div>
        </ReadoutDrawer>

        {electronicsHasSpec(vehicle?.electronics) ? (
          <div className="lg:col-span-2">
            <RadioBoxReadout electronics={vehicle?.electronics ?? {}} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-metal-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <BackToFeedButton onClose={onClose} />
        <button
          type="button"
          onClick={onFork}
          className="bg-hazard-orange px-5 py-3 font-display text-sm uppercase tracking-[0.22em] text-pit-black shadow-hazard-glow"
        >
          Fork to My Garage
        </button>
      </div>
    </div>
  );
}

function RadioBoxReadout({ electronics }: { electronics: ChassisElectronics }) {
  return (
    <ReadoutDrawer kicker="Drawer E · Radio Box & Electronics" title="Chassis Electronics">
      {RADIO_BOX_SLOTS.map((slot) => (
        <ElectronicsComponentReadout
          key={slot.key}
          label={slot.label}
          component={electronics[slot.key]}
          extra={slotExtras(slot.key, electronics)}
        />
      ))}
    </ReadoutDrawer>
  );
}

function slotExtras(key: (typeof RADIO_BOX_SLOTS)[number]['key'], electronics: ChassisElectronics): string | undefined {
  if (key === 'motor') {
    const parts: string[] = [];
    if (electronics.motor?.motorType) {
      parts.push(labelFrom(MOTOR_TYPES, electronics.motor.motorType));
    }
    if (electronics.motor?.kv != null) {
      parts.push(`${electronics.motor.kv} kV`);
    }
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }
  if (key === 'battery' && electronics.battery?.cellCount != null) {
    return `${electronics.battery.cellCount}S`;
  }
  if (key === 'steeringServo' && electronics.steeringServo?.torqueKg != null) {
    return `${electronics.steeringServo.torqueKg} kg·cm`;
  }
  return undefined;
}

function ElectronicsComponentReadout({
  label,
  component,
  extra,
}: {
  label: string;
  component?: ElectronicsComponent;
  extra?: string;
}) {
  if (!radioBoxSlotFilled(component) && !extra) {
    return null;
  }

  const name = component?.name?.trim();
  const url = component?.productUrl?.trim();
  const displayName = name || label;
  const linked = isHttpProductUrl(url);

  return (
    <div className="border border-metal-border bg-pit-black px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-readout-bright">
        {linked ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-hazard-orange underline decoration-neon-radio underline-offset-2 hover:text-neon-radio"
          >
            {displayName}
          </a>
        ) : (
          <span>{name || '—'}</span>
        )}
        {extra ? <span className="text-readout-dim"> · {extra}</span> : null}
      </dd>
    </div>
  );
}

function ReadoutDrawer({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="relative border-t-2 border-l-2 border-pit-rubber bg-pit-grease p-4 shadow-beveled-panel">
      <div className="border-b border-metal-border pb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hazard-orange">{kicker}</p>
        <h2 className="font-display text-xl uppercase tracking-wide text-readout-bright">{title}</h2>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </article>
  );
}

function TireReadout({
  axle,
  tire,
}: {
  axle: string;
  tire: SetupSettings['tiresAndWeight']['front'];
}) {
  return (
    <div className="col-span-full border border-metal-border bg-pit-black px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
        {axle} tires
      </dt>
      <dd className="font-mono text-xs text-readout-bright">
        {tire.brand} {tire.model} · {tire.compound} · {tire.wheelDiameterInch}" ·{' '}
        {labelFrom(FOAM_INSERTS, tire.insertType)} · {tire.brassWheelWeightGramsPerWheel}g brass
      </dd>
    </div>
  );
}

function ShockReadout({
  axle,
  spec,
}: {
  axle: string;
  spec: SetupSettings['suspension']['front'];
}) {
  return (
    <div className="col-span-full border border-metal-border bg-pit-black px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
        {axle} shocks
      </dt>
      <dd className="font-mono text-xs text-readout-bright">
        {formatShock(spec.oilViscosityValue, spec.oilViscosityUnit)} · {spec.springRateDescription} ·{' '}
        {spec.rideHeightMm}mm ride · {spec.camberAngleDeg}° camber
      </dd>
    </div>
  );
}

function Readout({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-metal-border bg-pit-black px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
        {label}
      </dt>
      <dd className={`font-mono text-sm ${accent ? 'text-hazard-orange' : 'text-readout-bright'}`}>
        {value}
      </dd>
    </div>
  );
}

function MissingSheetCard({ slug, onClose }: { slug?: string | null; onClose: () => void }) {
  return (
    <article>
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-hazard-orange">
        Pit inspection 404
      </p>
      <h1
        id="setup-inspect-title"
        className="mt-2 font-display text-3xl uppercase text-readout-bright"
      >
        Chassis tag not on the board
      </h1>
      <p className="mt-3 text-sm text-readout-dim">
        Unknown or private slug{slug ? ` “${slug}”` : ''}. Private sheets are never leaked from this
        route.
      </p>
      <div className="mt-5">
        <BackToFeedButton onClose={onClose} />
      </div>
    </article>
  );
}

function BackToFeedButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="border border-metal-border bg-pit-black px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-readout-dim hover:text-readout-bright"
    >
      Back to Community Feed
    </button>
  );
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

function labelFrom<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? humanize(value);
}

function formatInternalRatio(ratio: number): string {
  const preset = TRANSMISSION_PRESETS.find(
    (item) => Math.abs(item.internalRatio - ratio) < 0.001,
  );
  return preset ? preset.name : `${ratio.toFixed(2)}:1`;
}
