import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NotificationItem } from '../../api/notifications';
import { useNotificationStore } from '../../stores/useNotificationStore';

function badgeLabel(unreadCount: number): string {
  if (unreadCount <= 0) {
    return '';
  }
  return unreadCount > 99 ? '99+' : String(unreadCount);
}

function actorLabel(item: NotificationItem): string {
  return item.actorCallsign ?? 'A driver';
}

function setupLabel(item: NotificationItem): string {
  return item.setupTitle ?? 'a sheet';
}

function rowHeadline(item: NotificationItem): string {
  switch (item.type) {
    case 'like':
      return `${actorLabel(item)} liked ${setupLabel(item)}`;
    case 'fork':
      return `${actorLabel(item)} forked ${setupLabel(item)}`;
    case 'comment':
      return `${actorLabel(item)} on ${setupLabel(item)}`;
    case 'report_outcome':
      return `Report ${item.bodyPreview ?? 'resolved'}`;
    default:
      return 'Pit signal';
  }
}

function formatTimestamp(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

/**
 * Purpose: surface REST-polled pit signals on the diagnostic top bar without a social inbox or WebSocket.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const items = useNotificationStore((state) => state.items);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isLoading = useNotificationStore((state) => state.isLoading);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const fetchList = useNotificationStore((state) => state.fetchList);
  const markRead = useNotificationStore((state) => state.markRead);
  const startPolling = useNotificationStore((state) => state.startPolling);
  const stopPolling = useNotificationStore((state) => state.stopPolling);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startPolling();
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  useEffect(() => {
    void fetchUnreadCount();
  }, [fetchUnreadCount, location.pathname, location.search]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchUnreadCount();
      }
    };
    const onFocus = () => {
      void fetchUnreadCount();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const badge = badgeLabel(unreadCount);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      void fetchList();
    }
  };

  const handleRowClick = async (item: NotificationItem) => {
    await markRead([item.id]);
    if (item.type === 'report_outcome') {
      return;
    }
    if (!item.setupId) {
      return;
    }
    setOpen(false);
    navigate(`/feed?inspect=${encodeURIComponent(item.setupId)}`);
  };

  const handleMarkAll = async () => {
    await markRead();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Pit signals"
        onClick={handleToggle}
        className="relative border border-metal-border bg-pit-black px-3 py-2 font-display text-xs uppercase tracking-[0.2em] text-readout-dim transition hover:border-neon-radio hover:text-neon-radio"
      >
        Signals
        {badge ? (
          <span className="absolute -right-2 -top-2 min-w-[1.25rem] rounded-full bg-pit-black px-1 font-mono text-[10px] text-neon-radio shadow-neon-glow">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="region"
          aria-label="Pit signals"
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-metal-border bg-pit-steel shadow-beveled-panel"
        >
          <div className="flex items-center justify-between border-b border-metal-border px-3 py-2">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-readout-dim">
              Pit signals
            </p>
            <button
              type="button"
              onClick={() => {
                void handleMarkAll();
              }}
              className="font-display text-[10px] uppercase tracking-[0.16em] text-neon-radio transition hover:text-hazard-orange"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {isLoading && items.length === 0 ? (
              <p className="px-3 py-4 font-mono text-xs text-readout-muted">Loading signals…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 font-mono text-xs text-readout-muted">No pit signals</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id} className="border-b border-metal-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        void handleRowClick(item);
                      }}
                      className={`block w-full px-3 py-2 text-left transition hover:bg-pit-black ${
                        item.readAt ? 'opacity-70' : ''
                      }`}
                    >
                      <p className="font-mono text-xs text-readout-bright">{rowHeadline(item)}</p>
                      {item.type === 'comment' && item.bodyPreview ? (
                        <p className="mt-1 font-mono text-[11px] text-readout-muted">
                          {item.bodyPreview}
                        </p>
                      ) : null}
                      <p className="mt-1 font-mono text-[10px] text-readout-dim">
                        {formatTimestamp(item.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
