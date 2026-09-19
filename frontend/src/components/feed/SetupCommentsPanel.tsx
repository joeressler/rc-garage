import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiCreateComment,
  apiDeleteComment,
  apiListComments,
  type SetupComment,
} from '../../api/comments';
import { ApiError } from '../../api/http';
import { useAuthStore } from '../../stores/useAuthStore';
import { DriverAvatar } from './DriverAvatar';

interface SetupCommentsPanelProps {
  setupId: string;
  onRequestAuth: () => void;
  onReportComment: (target: { targetId: string; label: string }) => void;
}

/**
 * Purpose: host a flat Pit Notes thread on public inspect overlays without turning the clipboard editor into a chat surface.
 */
export function SetupCommentsPanel({
  setupId,
  onRequestAuth,
  onReportComment,
}: SetupCommentsPanelProps) {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSuspended = useAuthStore((state) => state.user?.isSuspended) === true;
  const [items, setItems] = useState<SetupComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    setLoadError(null);
    setActionError(null);

    void (async () => {
      setIsLoading(true);
      try {
        const page = await apiListComments(setupId, { limit: 20 }, token);
        if (cancelled) {
          return;
        }
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch (err: unknown) {
        if (cancelled) {
          return;
        }
        setLoadError(errorMessage(err, 'Unable to load pit notes.'));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setupId, token]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) {
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await apiListComments(
        setupId,
        { cursor: nextCursor, limit: 20 },
        token,
      );
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err: unknown) {
      setLoadError(errorMessage(err, 'Unable to load more pit notes.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePost = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) {
      onRequestAuth();
      return;
    }
    if (!token || isSuspended) {
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }
    setIsPosting(true);
    setActionError(null);
    try {
      await apiCreateComment(setupId, trimmed, token);
      setBody('');
      const page = await apiListComments(setupId, { limit: 20 }, token);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err: unknown) {
      setActionError(errorMessage(err, 'Unable to post pit note.'));
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!token) {
      return;
    }
    setDeletingId(commentId);
    setActionError(null);
    try {
      await apiDeleteComment(commentId, token);
      setItems((current) => current.filter((item) => item.id !== commentId));
    } catch (err: unknown) {
      setActionError(errorMessage(err, 'Unable to delete pit note.'));
    } finally {
      setDeletingId(null);
    }
  };

  const canCompose = isAuthenticated && !isSuspended && Boolean(token);

  return (
    <section className="space-y-4 border-t border-metal-border pt-4" data-testid="setup-comments-panel">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hazard-orange">
          Community annotations
        </p>
        <h2 className="font-display text-xl uppercase tracking-wide text-readout-bright">
          Pit Notes
        </h2>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-readout-muted">
          {items.length} note{items.length === 1 ? '' : 's'}
          {hasMore ? ' · more on the board' : ''}
        </p>
      </header>

      {loadError ? (
        <p className="border border-nitromethane/50 bg-nitromethane/10 p-2 font-mono text-xs text-nitromethane">
          {loadError}
        </p>
      ) : null}

      {actionError ? (
        <p className="border border-nitromethane/50 bg-nitromethane/10 p-2 font-mono text-xs text-nitromethane">
          {actionError}
        </p>
      ) : null}

      <ol className="space-y-3">
        {items.map((comment) => (
          <li
            key={comment.id}
            className="border border-metal-border bg-pit-black/40 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to={`/u/${encodeURIComponent(comment.author.callsign)}`}
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-hazard-orange hover:text-readout-bright"
              >
                <DriverAvatar
                  callsign={comment.author.callsign}
                  avatarUrl={comment.author.avatarUrl}
                  size="sm"
                />
                @{comment.author.callsign}
              </Link>
              <time
                dateTime={comment.createdAt}
                className="font-mono text-[10px] uppercase tracking-widest text-readout-muted"
              >
                {new Date(comment.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap font-mono text-xs text-readout-bright">
              {comment.body}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {comment.isAuthor ? (
                <button
                  type="button"
                  disabled={deletingId === comment.id}
                  onClick={() => void handleDelete(comment.id)}
                  className="border border-nitromethane px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-nitromethane disabled:opacity-50"
                >
                  {deletingId === comment.id ? 'Deleting…' : 'Delete'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onReportComment({
                      targetId: comment.id,
                      label: `Pit note by @${comment.author.callsign}`,
                    })
                  }
                  className="border border-metal-border px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-readout-dim hover:text-hazard-orange"
                >
                  Report
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      {items.length === 0 && !isLoading && !loadError ? (
        <p className="font-mono text-xs text-readout-muted">No pit notes on this sheet yet.</p>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={isLoading}
          className="border border-hazard-orange bg-pit-black px-4 py-2 font-display text-xs uppercase tracking-widest text-hazard-orange disabled:opacity-50"
        >
          {isLoading ? 'Loading…' : 'Load more notes'}
        </button>
      ) : null}

      {canCompose ? (
        <form onSubmit={(event) => void handlePost(event)} className="space-y-2">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
              Post a pit note
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-readout-muted">
              {body.trim().length}/2000
            </span>
            <button
              type="submit"
              disabled={isPosting || body.trim().length === 0}
              className="border border-hazard-orange bg-hazard-orange px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-pit-black disabled:opacity-50"
            >
              {isPosting ? 'Posting…' : 'Post note'}
            </button>
          </div>
        </form>
      ) : isAuthenticated ? null : (
        <button
          type="button"
          onClick={onRequestAuth}
          className="border border-hazard-orange px-4 py-2 font-display text-xs uppercase tracking-widest text-hazard-orange"
        >
          Sign in to post a pit note
        </button>
      )}
    </section>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.messages.join(' ') || fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
