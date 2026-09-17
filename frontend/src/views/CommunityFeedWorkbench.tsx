import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedItem } from '../api/feed';
import type { SurfaceType } from '../api/setups';
import type { VehicleClass } from '../api/vehicles';
import { FeedFilterDrawer } from '../components/feed/FeedFilterDrawer';
import { SetupSheetCard } from '../components/feed/SetupSheetCard';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore } from '../stores/useGarageStore';
import { useSetupStore } from '../stores/useSetupStore';

interface CommunityFeedWorkbenchProps {
  onRequestAuth: () => void;
}

/**
 * Purpose: render the community discovery feed workbench with multi-vector filters, setup sheet cards, quick-forking, and like toggles.
 */
export function CommunityFeedWorkbench({ onRequestAuth }: CommunityFeedWorkbenchProps) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const vehicles = useGarageStore((state) => state.vehicles);
  const activeVehicleId = useGarageStore((state) => state.activeVehicleId);

  const feedSetups = useSetupStore((state) => state.feedSetups);
  const feedFilters = useSetupStore((state) => state.feedFilters);
  const feedHasMore = useSetupStore((state) => state.feedHasMore);
  const isFeedLoading = useSetupStore((state) => state.isFeedLoading);
  const feedError = useSetupStore((state) => state.feedError);

  const fetchFeed = useSetupStore((state) => state.fetchFeed);
  const setFeedFilters = useSetupStore((state) => state.setFeedFilters);
  const toggleLike = useSetupStore((state) => state.toggleLike);
  const forkSetupIntoGarage = useSetupStore((state) => state.forkSetupIntoGarage);

  // Fork Modal State
  const [forkModalOpen, setForkModalOpen] = useState(false);
  const [selectedFeedItem, setSelectedFeedItem] = useState<FeedItem | null>(null);
  const [targetVehicleId, setTargetVehicleId] = useState<string>('');
  const [forkTitle, setForkTitle] = useState<string>('');
  const [isForking, setIsForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  // Search input debouncer / local state
  const [searchInput, setSearchInput] = useState(feedFilters.vehicleModel ?? '');

  // Fetch feed on initial mount and when filters change
  useEffect(() => {
    void fetchFeed(true);
  }, [
    feedFilters.sortBy,
    feedFilters.surfaceType,
    feedFilters.vehicleClass,
    feedFilters.vehicleModel,
  ]);

  const handleSelectSurface = (surface?: SurfaceType) => {
    setFeedFilters({ surfaceType: surface });
  };

  const handleSelectClass = (cls?: VehicleClass) => {
    setFeedFilters({ vehicleClass: cls });
  };

  const handleSelectSort = (sort: typeof feedFilters.sortBy) => {
    setFeedFilters({ sortBy: sort });
  };

  const handleChangeModel = (model: string) => {
    setSearchInput(model);
    setFeedFilters({ vehicleModel: model.trim() || undefined });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setFeedFilters({
      surfaceType: undefined,
      vehicleClass: undefined,
      vehicleModel: undefined,
      sortBy: 'newest',
    });
  };

  const handleInspect = (item: FeedItem) => {
    navigate(`/clipboard?setupId=${encodeURIComponent(item.id)}`);
  };

  const handleQuickFork = (item: FeedItem) => {
    if (!isAuthenticated) {
      onRequestAuth();
      return;
    }
    setSelectedFeedItem(item);
    setForkTitle(`Fork of ${item.title}`);
    setTargetVehicleId(activeVehicleId ?? (vehicles[0]?.id || ''));
    setForkError(null);
    setForkModalOpen(true);
  };

  const handleConfirmFork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedItem || !targetVehicleId) {
      setForkError('Please choose a vehicle in your garage.');
      return;
    }

    setIsForking(true);
    setForkError(null);
    try {
      const forked = await forkSetupIntoGarage(
        selectedFeedItem.id,
        targetVehicleId,
        forkTitle,
      );
      setForkModalOpen(false);
      navigate(`/clipboard?setupId=${encodeURIComponent(forked.id)}`);
    } catch (err: unknown) {
      setForkError(err instanceof Error ? err.message : 'Fork failed');
    } finally {
      setIsForking(false);
    }
  };

  const handleToggleLike = async (item: FeedItem) => {
    if (!isAuthenticated) {
      onRequestAuth();
      return;
    }
    try {
      await toggleLike(item.id);
    } catch {
      // Handled in store
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* View Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-pit-rubber pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="border border-hazard-orange bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-hazard-orange">
              Drawer 03
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-readout-dim">
              Community Discovery Feed
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wider text-readout-bright">
            Global RC Setup Workbench
          </h1>
          <p className="mt-1 font-mono text-xs text-readout-muted">
            Inspect race telemetry, branch setups into your garage, and share track-tested tuning specs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-readout-dim">
            Total Sheets: <span className="font-bold text-readout-bright">{feedSetups.length}</span>
          </span>
          <button
            type="button"
            onClick={() => void fetchFeed(true)}
            className="border border-metal-border bg-pit-black px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-readout-bright hover:border-hazard-orange hover:text-hazard-orange"
          >
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Filter Drawer */}
      <FeedFilterDrawer
        surfaceType={feedFilters.surfaceType}
        vehicleClass={feedFilters.vehicleClass}
        sortBy={feedFilters.sortBy ?? 'newest'}
        searchModel={searchInput}
        onSelectSurface={handleSelectSurface}
        onSelectClass={handleSelectClass}
        onSelectSort={handleSelectSort}
        onChangeModel={handleChangeModel}
        onReset={handleResetFilters}
      />

      {/* Error Notice */}
      {feedError ? (
        <div className="mb-6 border border-nitromethane/50 bg-nitromethane/10 p-4 font-mono text-xs text-nitromethane">
          {feedError}
        </div>
      ) : null}

      {/* Feed Cards Grid */}
      {feedSetups.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {feedSetups.map((item) => (
            <SetupSheetCard
              key={item.id}
              item={item}
              onInspect={handleInspect}
              onQuickFork={handleQuickFork}
              onToggleLike={handleToggleLike}
            />
          ))}
        </div>
      ) : !isFeedLoading ? (
        <div className="border border-metal-border bg-pit-steel p-12 text-center">
          <p className="font-mono text-sm uppercase tracking-wider text-readout-muted">
            No public setups found matching current filters.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 border border-hazard-orange bg-hazard-orange px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-pit-black hover:bg-hazard-orange/90"
          >
            Clear All Filters
          </button>
        </div>
      ) : null}

      {/* Loading Indicator / Keyset Pagination Trigger */}
      <div className="mt-10 flex flex-col items-center justify-center gap-3">
        {isFeedLoading ? (
          <p className="font-mono text-xs uppercase tracking-widest text-hazard-orange animate-pulse">
            Querying Community Telemetry Matrix…
          </p>
        ) : feedHasMore ? (
          <button
            type="button"
            onClick={() => void fetchFeed(false)}
            className="border border-hazard-orange bg-pit-black px-6 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-hazard-orange hover:bg-hazard-orange hover:text-pit-black transition"
          >
            Load More Telemetry Sheets
          </button>
        ) : feedSetups.length > 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
            End of Community Feed
          </span>
        ) : null}
      </div>

      {/* Quick Fork Modal */}
      {forkModalOpen && selectedFeedItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fork-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-lg border-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel">
            <div className="flex items-center justify-between border-b border-metal-border pb-3">
              <h2
                id="fork-modal-title"
                className="font-display text-lg font-bold uppercase tracking-wider text-readout-bright"
              >
                Fork Telemetry into Garage
              </h2>
              <button
                type="button"
                onClick={() => setForkModalOpen(false)}
                className="font-mono text-sm text-readout-muted hover:text-readout-bright"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleConfirmFork(e)} className="mt-4 space-y-4">
              {forkError ? (
                <p className="border border-nitromethane/50 bg-nitromethane/10 p-2 font-mono text-xs text-nitromethane">
                  {forkError}
                </p>
              ) : null}

              <div>
                <span className="block font-mono text-[10px] uppercase tracking-widest text-readout-muted">
                  Source Setup Sheet
                </span>
                <p className="font-display text-sm font-bold text-readout-bright">
                  {selectedFeedItem.title}{' '}
                  <span className="font-mono text-xs font-normal text-hazard-orange">
                    (@{selectedFeedItem.author.callsign})
                  </span>
                </p>
              </div>

              <div>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
                    New Setup Title
                  </span>
                  <input
                    type="text"
                    required
                    value={forkTitle}
                    onChange={(e) => setForkTitle(e.target.value)}
                    className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
                  />
                </label>
              </div>

              <div>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
                    Assign to Fleet Vehicle
                  </span>
                  {vehicles.length > 0 ? (
                    <select
                      value={targetVehicleId}
                      onChange={(e) => setTargetVehicleId(e.target.value)}
                      className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} — {v.make} {v.model} ({v.scale})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 font-mono text-xs text-hazard-orange">
                      You need at least one vehicle in your garage to fork a setup sheet.
                    </p>
                  )}
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-metal-border pt-4">
                <button
                  type="button"
                  onClick={() => setForkModalOpen(false)}
                  className="border border-metal-border bg-pit-black px-4 py-2 font-mono text-xs uppercase tracking-wider text-readout-dim hover:text-readout-bright"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isForking || vehicles.length === 0}
                  className="border border-hazard-orange bg-hazard-orange px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-pit-black hover:bg-hazard-orange/90 disabled:opacity-50"
                >
                  {isForking ? 'Forking Spec…' : 'Fork Setup Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
