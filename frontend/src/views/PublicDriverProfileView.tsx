import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { FeedItem } from '../api/feed';
import { apiToggleLike } from '../api/feed';
import { ApiError } from '../api/http';
import { apiGetPublicProfile, type PublicDriverProfile } from '../api/profiles';
import { DriverAvatar } from '../components/feed/DriverAvatar';
import {
  ForkToGarageModal,
  type ForkToGarageSource,
} from '../components/feed/ForkToGarageModal';
import { SetupInspectOverlay } from '../components/feed/SetupInspectOverlay';
import { SetupSheetCard } from '../components/feed/SetupSheetCard';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore } from '../stores/useGarageStore';
import { useSetupStore } from '../stores/useSetupStore';

interface PublicDriverProfileViewProps {
  onRequestAuth: () => void;
}

/**
 * Purpose: render a public setup-sheet index for a driver callsign without exposing private pits.
 */
export function PublicDriverProfileView({ onRequestAuth }: PublicDriverProfileViewProps) {
  const { callsign } = useParams<{ callsign: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const vehicles = useGarageStore((state) => state.vehicles);
  const activeVehicleId = useGarageStore((state) => state.activeVehicleId);
  const forkSetupIntoGarage = useSetupStore((state) => state.forkSetupIntoGarage);

  const [profile, setProfile] = useState<PublicDriverProfile | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inspectItem, setInspectItem] = useState<FeedItem | null>(null);
  const [forkSource, setForkSource] = useState<ForkToGarageSource | null>(null);

  useEffect(() => {
    if (!callsign) {
      setMissing(true);
      setProfile(null);
      setItems([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setMissing(false);
    setLoadError(null);
    setProfile(null);
    setItems([]);
    setInspectItem(null);

    void (async () => {
      try {
        const loaded = await apiGetPublicProfile(callsign, { limit: 20 }, token);
        if (cancelled) {
          return;
        }
        setProfile(loaded);
        setItems(loaded.items);
      } catch (err: unknown) {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 400)) {
          setMissing(true);
          return;
        }
        setLoadError('Unable to load driver garage.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callsign, token]);

  const handleLoadMore = async () => {
    if (!callsign || !profile?.nextCursor || isLoading) {
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await apiGetPublicProfile(
        callsign,
        { cursor: profile.nextCursor, limit: 20 },
        token,
      );
      setProfile(page);
      setItems((current) => [...current, ...page.items]);
    } catch {
      setLoadError('Unable to load more telemetry sheets.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFork = (source: ForkToGarageSource) => {
    if (!isAuthenticated) {
      onRequestAuth();
      return;
    }
    setForkSource(source);
  };

  const handleQuickFork = (item: FeedItem) => {
    handleOpenFork({
      id: item.id,
      title: item.title,
      authorCallsign: item.author.callsign,
    });
  };

  const handleToggleLike = async (item: FeedItem) => {
    if (!isAuthenticated || !token) {
      onRequestAuth();
      return;
    }
    try {
      const result = await apiToggleLike(item.id, token);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, isLikedByCaller: result.liked, likeCount: result.likeCount }
            : entry,
        ),
      );
      useSetupStore.setState((state) => ({
        feedSetups: state.feedSetups.map((entry) =>
          entry.id === item.id
            ? { ...entry, isLikedByCaller: result.liked, likeCount: result.likeCount }
            : entry,
        ),
      }));
    } catch {
      setLoadError('Unable to update like on this sheet.');
    }
  };

  const handleConfirmFork = async (payload: { targetVehicleId: string; title: string }) => {
    if (!forkSource) {
      throw new Error('No setup selected to fork.');
    }
    const forked = await forkSetupIntoGarage(
      forkSource.id,
      payload.targetVehicleId,
      payload.title,
    );
    setForkSource(null);
    navigate(`/clipboard?setupId=${encodeURIComponent(forked.id)}`);
  };

  if (missing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="font-display text-3xl uppercase tracking-wider text-readout-bright">
          Driver not found
        </h1>
        <p className="mt-2 font-mono text-sm text-readout-muted">
          No public garage is logged for this callsign.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start gap-4 border-b-2 border-pit-rubber pb-6">
        {profile ? (
          <DriverAvatar
            callsign={profile.callsign}
            avatarUrl={profile.avatarUrl}
            size="md"
          />
        ) : (
          <div className="h-12 w-12 rounded-full border border-metal-border bg-pit-steel" />
        )}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-hazard-orange">
            Public Driver Garage
          </p>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-wider text-readout-bright">
            @{profile?.callsign ?? callsign}
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-sm text-readout-dim">
            {profile?.bio?.trim() ? profile.bio : 'No bio logged'}
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-readout-muted">
            Public sheets:{' '}
            <span className="text-readout-bright">{profile?.publicSetupCount ?? 0}</span>
          </p>
        </div>
      </header>

      {loadError ? (
        <div className="mb-6 border border-nitromethane/50 bg-nitromethane/10 p-4 font-mono text-xs text-nitromethane">
          {loadError}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <SetupSheetCard
              key={item.id}
              item={item}
              onInspect={setInspectItem}
              onQuickFork={handleQuickFork}
              onToggleLike={(card) => void handleToggleLike(card)}
            />
          ))}
        </div>
      ) : !isLoading && profile ? (
        <div className="border border-metal-border bg-pit-steel p-12 text-center">
          <p className="font-mono text-sm uppercase tracking-wider text-readout-muted">
            No public setups logged on this garage.
          </p>
        </div>
      ) : null}

      <div className="mt-10 flex flex-col items-center justify-center gap-3">
        {isLoading ? (
          <p className="animate-pulse font-mono text-xs uppercase tracking-widest text-hazard-orange">
            Querying driver garage…
          </p>
        ) : profile?.hasMore ? (
          <button
            type="button"
            onClick={() => void handleLoadMore()}
            className="border border-hazard-orange bg-pit-black px-6 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-hazard-orange transition hover:bg-hazard-orange hover:text-pit-black"
          >
            Load More Telemetry Sheets
          </button>
        ) : null}
      </div>

      <SetupInspectOverlay
        open={inspectItem !== null}
        setupId={inspectItem?.id}
        authorCallsign={inspectItem?.author.callsign}
        authorAvatarUrl={inspectItem?.author.avatarUrl}
        onClose={() => setInspectItem(null)}
        onRequestFork={handleOpenFork}
        onRequestAuth={onRequestAuth}
      />

      <ForkToGarageModal
        open={forkSource !== null}
        source={forkSource}
        vehicles={vehicles}
        defaultVehicleId={activeVehicleId ?? vehicles[0]?.id}
        onClose={() => setForkSource(null)}
        onConfirm={handleConfirmFork}
      />
    </div>
  );
}
