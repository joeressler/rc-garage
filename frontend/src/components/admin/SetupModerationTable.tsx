import { useState } from 'react';
import type { AdminSetupSummary, UserRole } from '../../api/admin';
import { ModerationActionModal } from './ModerationActionModal';

interface SetupModerationTableProps {
  setups: AdminSetupSummary[];
  currentUserRole?: UserRole;
  hasMore: boolean;
  isLoading: boolean;
  isActionLoading: boolean;
  actionError: string | null;
  onLoadMore: () => void;
  onToggleVisibility: (
    setupId: string,
    hide: boolean,
    reason?: string,
  ) => Promise<unknown>;
  onDeleteSetup: (setupId: string, reason: string) => Promise<unknown>;
}

/**
 * Purpose: review public, private, and hidden setups with force-hide and admin-only hard delete controls.
 */
export function SetupModerationTable({
  setups,
  currentUserRole,
  hasMore,
  isLoading,
  isActionLoading,
  actionError,
  onLoadMore,
  onToggleVisibility,
  onDeleteSetup,
}: SetupModerationTableProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    setup: AdminSetupSummary | null;
    action: 'hide' | 'unhide' | 'delete';
  }>({
    isOpen: false,
    setup: null,
    action: 'hide',
  });

  const handleOpenVisibility = (setup: AdminSetupSummary) => {
    setModalState({
      isOpen: true,
      setup,
      action: setup.isHidden ? 'unhide' : 'hide',
    });
  };

  const handleOpenDelete = (setup: AdminSetupSummary) => {
    setModalState({
      isOpen: true,
      setup,
      action: 'delete',
    });
  };

  const handleModalConfirm = async (reason: string) => {
    if (!modalState.setup) return;
    const { setup, action } = modalState;

    if (action === 'hide') {
      await onToggleVisibility(setup.id, true, reason);
    } else if (action === 'unhide') {
      await onToggleVisibility(setup.id, false, reason);
    } else if (action === 'delete') {
      await onDeleteSetup(setup.id, reason);
    }
  };

  const isAdmin = currentUserRole === 'admin';

  return (
    <div className="border border-metal-border bg-pit-grease p-4 shadow-beveled-panel">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-xs">
          <thead>
            <tr className="border-b border-metal-border font-mono uppercase tracking-wider text-readout-muted">
              <th className="pb-2">Setup Sheet</th>
              <th className="pb-2">Author & Vehicle</th>
              <th className="pb-2">Telemetry</th>
              <th className="pb-2">Visibility</th>
              <th className="pb-2">Created</th>
              <th className="pb-2 text-right">Moderation Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-metal-border/50">
            {setups.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-readout-muted">
                  No setup sheets matched the active filters.
                </td>
              </tr>
            )}
            {setups.map((s) => (
              <tr key={s.id} className="hover:bg-pit-steel/30">
                <td className="py-3">
                  <div className="font-mono font-bold text-readout-bright">
                    {s.title}
                  </div>
                  <div className="font-mono text-[11px] text-readout-muted">
                    Slug: {s.qrSlug}
                  </div>
                  {s.hiddenReason && (
                    <div className="mt-1 font-mono text-[10px] text-hazard-orange">
                      Hidden Reason: {s.hiddenReason}
                    </div>
                  )}
                </td>
                <td className="py-3">
                  <div className="font-mono text-readout-dim">
                    @{s.authorCallsign}
                  </div>
                  <div className="text-[11px] text-readout-muted">
                    {s.vehicleMake} {s.vehicleModel}
                  </div>
                </td>
                <td className="py-3 font-mono text-readout-dim">
                  <div>FDR: {s.calculatedFdr}</div>
                  <div className="text-[10px] text-readout-muted">
                    Front: {s.frontBiasPercentage}%
                  </div>
                </td>
                <td className="py-3">
                  {s.isHidden ? (
                    <span className="inline-block border border-hazard-orange bg-hazard-orange/10 px-2 py-0.5 font-mono text-[10px] uppercase text-hazard-orange">
                      Force-Hidden
                    </span>
                  ) : s.isPublic ? (
                    <span className="inline-block border border-neon-radio bg-neon-radio/10 px-2 py-0.5 font-mono text-[10px] uppercase text-neon-radio">
                      Public Feed
                    </span>
                  ) : (
                    <span className="inline-block border border-metal-border bg-pit-black/40 px-2 py-0.5 font-mono text-[10px] uppercase text-readout-muted">
                      Private
                    </span>
                  )}
                </td>
                <td className="py-3 font-mono text-readout-muted">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Hide / Unhide Toggle */}
                    <button
                      type="button"
                      onClick={() => handleOpenVisibility(s)}
                      disabled={isActionLoading}
                      className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                        s.isHidden
                          ? 'border-neon-radio bg-neon-radio/10 text-neon-radio hover:bg-neon-radio/20'
                          : 'border-hazard-orange bg-hazard-orange/10 text-hazard-orange hover:bg-hazard-orange/20'
                      }`}
                    >
                      {s.isHidden ? 'Restore' : 'Force-Hide'}
                    </button>

                    {/* Admin-only Hard Delete */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(s)}
                        disabled={isActionLoading}
                        className="border border-hazard-orange/50 bg-hazard-orange/20 px-2 py-1 font-mono text-[10px] uppercase text-hazard-orange hover:bg-hazard-orange hover:text-pit-black"
                        title="Permanently hard-delete setup sheet"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center border-t border-metal-border pt-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoading}
            className="border border-metal-border bg-pit-steel px-4 py-1.5 font-display text-xs uppercase tracking-wider text-readout-bright hover:border-metal-highlight disabled:opacity-50"
          >
            {isLoading ? 'Loading Setups...' : 'Load More Setups'}
          </button>
        </div>
      )}

      <ModerationActionModal
        isOpen={modalState.isOpen}
        title={
          modalState.action === 'hide'
            ? 'Force-Hide Setup Sheet'
            : modalState.action === 'unhide'
            ? 'Restore Setup Visibility'
            : 'Hard-Delete Setup Sheet'
        }
        description={
          modalState.action === 'hide'
            ? 'Force-hiding removes this setup from the community discovery feed and chassis inspection route.'
            : modalState.action === 'unhide'
            ? 'Restoring visibility allows this setup to reappear on the community feed and QR inspection.'
            : 'Permanently deletes this setup from the database. Child forks retain lineage via ON DELETE SET NULL.'
        }
        targetName={`"${modalState.setup?.title ?? ''}"`}
        actionLabel={
          modalState.action === 'hide'
            ? 'Confirm Force-Hide'
            : modalState.action === 'unhide'
            ? 'Confirm Restore'
            : 'Permanently Delete'
        }
        danger={modalState.action !== 'unhide'}
        requireReason={modalState.action !== 'unhide'}
        isLoading={isActionLoading}
        error={actionError}
        onConfirm={handleModalConfirm}
        onClose={() => setModalState({ isOpen: false, setup: null, action: 'hide' })}
      />
    </div>
  );
}
