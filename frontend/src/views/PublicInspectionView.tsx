import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/http';
import {
  apiResolveInspection,
  type PublicInspectionSheet,
} from '../api/qr';
import { formatFdr, formatShock, VEHICLE_CLASS_LABELS } from '../lib/vehicle-labels';
import { useAuthStore } from '../stores/useAuthStore';

interface PublicInspectionViewProps {
  onRequestAuth: () => void;
}

/**
 * Purpose: render an unauthenticated mobile pit-inspection sheet from a chassis QR slug.
 */
export function PublicInspectionView({ onRequestAuth }: PublicInspectionViewProps) {
  const { slug } = useParams<{ slug: string }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [sheet, setSheet] = useState<PublicInspectionSheet | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setMissing(true);
      return;
    }

    let cancelled = false;
    setSheet(null);
    setMissing(false);
    setLoadError(null);

    void apiResolveInspection(slug)
      .then((payload) => {
        if (!cancelled) {
          setSheet(payload);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 404) {
          setMissing(true);
          return;
        }
        setLoadError('Unable to load chassis inspection sheet.');
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen pit-mat-grid px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        {missing ? <MissingSlugCard slug={slug} /> : null}
        {loadError ? (
          <article className="border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel">
            <p className="font-mono text-sm text-hazard-orange">{loadError}</p>
          </article>
        ) : null}
        {!sheet && !missing && !loadError ? (
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-readout-dim">
            Resolving chassis slug…
          </p>
        ) : null}
        {sheet ? (
          <InspectionCard
            sheet={sheet}
            isAuthenticated={isAuthenticated}
            onRequestAuth={onRequestAuth}
          />
        ) : null}
      </div>
    </div>
  );
}

function MissingSlugCard({ slug }: { slug?: string }) {
  return (
    <article className="relative border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-hazard-orange">
        Pit inspection 404
      </p>
      <h1 className="mt-2 font-display text-3xl uppercase text-readout-bright">
        Chassis tag not on the board
      </h1>
      <p className="mt-3 text-sm text-readout-dim">
        Unknown or private slug{slug ? ` “${slug}”` : ''}. Private sheets are never leaked from this
        route.
      </p>
      <Link
        to="/garage"
        className="mt-5 inline-block border border-metal-border px-3 py-2 font-display text-xs uppercase tracking-[0.2em] text-readout-dim"
      >
        Return to garage
      </Link>
    </article>
  );
}

function InspectionCard({
  sheet,
  isAuthenticated,
  onRequestAuth,
}: {
  sheet: PublicInspectionSheet;
  isAuthenticated: boolean;
  onRequestAuth: () => void;
}) {
  const navigate = useNavigate();
  const classLabel = VEHICLE_CLASS_LABELS[sheet.vehicle.vehicleClass];

  return (
    <article className="relative overflow-hidden border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel">
      <span className="hex-rivet left-2 top-2" />
      <span className="hex-rivet right-2 top-2" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-anodized-blue">
            Public pit inspection
          </p>
          <h1 className="mt-1 font-display text-3xl uppercase leading-none text-readout-bright">
            {sheet.vehicle.make} {sheet.vehicle.model}
          </h1>
          <p className="mt-2 font-mono text-xs text-readout-dim">{sheet.vehicle.name}</p>
        </div>
        <span className="self-start whitespace-nowrap border border-hazard-orange px-2 py-1 font-display text-[11px] uppercase tracking-widest text-hazard-orange">
          {sheet.vehicle.scale} · {classLabel}
        </span>
      </div>

      <p className="mt-4 font-display text-lg uppercase text-readout-bright">{sheet.title}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Readout label="FDR" value={formatFdr(sheet.calculatedFdr)} accent />
        <Readout label="Battery" value={`${sheet.batteryCellCount}S`} />
        <Readout
          label="Front shock"
          value={formatShock(
            sheet.frontShock.oilViscosityValue,
            sheet.frontShock.oilViscosityUnit,
          )}
        />
        <Readout
          label="Rear shock"
          value={formatShock(
            sheet.rearShock.oilViscosityValue,
            sheet.rearShock.oilViscosityUnit,
          )}
        />
      </dl>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <TireTag axle="Front" tire={sheet.frontTire} />
        <TireTag axle="Rear" tire={sheet.rearTire} />
      </div>

      {sheet.verified ? (
        <p className="mt-5 inline-block rotate-[-2deg] border-2 border-neon-radio px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.18em] text-neon-radio shadow-neon-glow">
          Verified scrutineering
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (!isAuthenticated) {
            onRequestAuth();
            return;
          }
          navigate('/garage');
        }}
        className="mt-6 w-full bg-hazard-orange py-3 font-display text-sm uppercase tracking-[0.22em] text-pit-black shadow-hazard-glow"
      >
        Fork this setup into your Garage
      </button>
      {isAuthenticated ? (
        <p className="mt-2 font-mono text-[10px] text-readout-muted">
          Pick an active chassis in Fleet Garage. Forking onto that bay ships with the setup
          clipboard.
        </p>
      ) : (
        <p className="mt-2 font-mono text-[10px] text-readout-muted">
          Sign in, then choose a chassis in Fleet Garage before forking.
        </p>
      )}
    </article>
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
      <dd
        className={`font-mono text-lg ${accent ? 'text-hazard-orange' : 'text-readout-bright'}`}
      >
        {value}
      </dd>
    </div>
  );
}

function TireTag({
  axle,
  tire,
}: {
  axle: string;
  tire: PublicInspectionSheet['frontTire'];
}) {
  return (
    <p className="border border-metal-border bg-pit-grease px-3 py-2 font-mono text-xs text-readout-dim">
      <span className="text-readout-muted">{axle}:</span> {tire.brand} {tire.model} · {tire.compound}
    </p>
  );
}
