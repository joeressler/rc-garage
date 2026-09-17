import { SURFACES } from '../../api/setups-constants';
import type { SurfaceType } from '../../api/setups';
import { VEHICLE_CLASSES, type VehicleClass } from '../../api/vehicles';
import { VEHICLE_CLASS_LABELS } from '../../lib/vehicle-labels';
import type { FeedSortBy } from '../../api/feed';

interface FeedFilterDrawerProps {
  surfaceType?: SurfaceType;
  vehicleClass?: VehicleClass;
  sortBy: FeedSortBy;
  searchModel?: string;
  onSelectSurface: (surface?: SurfaceType) => void;
  onSelectClass: (vehicleClass?: VehicleClass) => void;
  onSelectSort: (sort: FeedSortBy) => void;
  onChangeModel: (model: string) => void;
  onReset: () => void;
}

/**
 * Purpose: provide multi-vector filter controls for terrain surface, vehicle class chips, model search, and sort toggles.
 */
export function FeedFilterDrawer({
  surfaceType,
  vehicleClass,
  sortBy,
  searchModel = '',
  onSelectSurface,
  onSelectClass,
  onSelectSort,
  onChangeModel,
  onReset,
}: FeedFilterDrawerProps) {
  const hasActiveFilters = Boolean(
    surfaceType || vehicleClass || (searchModel && searchModel.trim() !== '') || sortBy !== 'newest',
  );

  return (
    <aside
      aria-label="Community Feed Filters"
      className="mb-8 border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-metal-border pb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hazard-orange">
            Telemetry Filter Matrix
          </span>
          <span className="border border-metal-border bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-readout-dim">
            Multi-Vector Discovery
          </span>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-xs uppercase tracking-wider text-hazard-orange hover:underline"
          >
            Reset Filters
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Terrain Surface Selector */}
        <div>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-readout-muted">
              Terrain Surface
            </span>
            <select
              value={surfaceType ?? ''}
              onChange={(e) => onSelectSurface((e.target.value as SurfaceType) || undefined)}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            >
              <option value="">All Surfaces (Global Feed)</option>
              {SURFACES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {/* Model Search */}
          <label className="mt-3 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-readout-muted">
              Filter by Model Name
            </span>
            <input
              type="text"
              value={searchModel}
              onChange={(e) => onChangeModel(e.target.value)}
              placeholder="e.g. Phoenix, SCX10, Enduro"
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            >
            </input>
          </label>
        </div>

        {/* Sorting Toggles */}
        <div>
          <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-readout-muted">
            Sort Telemetry Sheets
          </span>
          <div className="mt-1.5 flex flex-col gap-2">
            {[
              { id: 'newest', label: 'Newest Releases' },
              { id: 'most_forked', label: 'Most Forked Lineage' },
              { id: 'most_liked', label: 'Top Rated & Liked' },
            ].map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-2.5 border px-3 py-2 font-mono text-xs uppercase tracking-wider transition ${
                  sortBy === option.id
                    ? 'border-hazard-orange bg-pit-black text-hazard-orange'
                    : 'border-metal-border bg-pit-black/50 text-readout-dim hover:text-readout-bright'
                }`}
              >
                <input
                  type="radio"
                  name="feedSort"
                  value={option.id}
                  checked={sortBy === option.id}
                  onChange={() => onSelectSort(option.id as FeedSortBy)}
                  className="accent-hazard-orange"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Vehicle Class Chips */}
        <div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-readout-muted">
              Vehicle Class
            </span>
            {vehicleClass ? (
              <button
                type="button"
                onClick={() => onSelectClass(undefined)}
                className="font-mono text-[10px] text-readout-muted underline hover:text-readout-bright"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {VEHICLE_CLASSES.map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => onSelectClass(vehicleClass === cls ? undefined : cls)}
                className={`border px-2 py-1 font-display text-[10px] uppercase tracking-wider transition ${
                  vehicleClass === cls
                    ? 'border-neon-radio bg-pit-black text-neon-radio shadow-neon-glow'
                    : 'border-metal-border bg-pit-black/60 text-readout-dim hover:border-metal-highlight hover:text-readout-bright'
                }`}
              >
                {VEHICLE_CLASS_LABELS[cls]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
