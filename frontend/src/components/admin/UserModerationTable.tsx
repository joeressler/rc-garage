import { useState } from 'react';
import type { AdminUserSummary, UserRole } from '../../api/admin';
import { ModerationActionModal } from './ModerationActionModal';

interface UserModerationTableProps {
  users: AdminUserSummary[];
  currentUserRole?: UserRole;
  currentUserId?: string;
  hasMore: boolean;
  isLoading: boolean;
  isActionLoading: boolean;
  actionError: string | null;
  onLoadMore: () => void;
  onSuspend: (
    userId: string,
    suspend: boolean,
    reason?: string,
  ) => Promise<unknown>;
  onChangeRole: (
    userId: string,
    role: UserRole,
    reason?: string,
  ) => Promise<unknown>;
}

/**
 * Purpose: display driver accounts with suspension status, vehicle/setup counts, role elevation, and moderation actions.
 */
export function UserModerationTable({
  users,
  currentUserRole,
  currentUserId,
  hasMore,
  isLoading,
  isActionLoading,
  actionError,
  onLoadMore,
  onSuspend,
  onChangeRole,
}: UserModerationTableProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    user: AdminUserSummary | null;
    action: 'suspend' | 'reinstate' | 'promote' | 'demote';
    targetRole?: UserRole;
  }>({
    isOpen: false,
    user: null,
    action: 'suspend',
  });

  const handleOpenSuspend = (user: AdminUserSummary) => {
    setModalState({
      isOpen: true,
      user,
      action: user.isSuspended ? 'reinstate' : 'suspend',
    });
  };

  const handleOpenRoleChange = (user: AdminUserSummary, newRole: UserRole) => {
    setModalState({
      isOpen: true,
      user,
      action: newRole === 'driver' ? 'demote' : 'promote',
      targetRole: newRole,
    });
  };

  const handleModalConfirm = async (reason: string) => {
    if (!modalState.user) return;
    const { user, action, targetRole } = modalState;

    if (action === 'suspend') {
      await onSuspend(user.id, true, reason);
    } else if (action === 'reinstate') {
      await onSuspend(user.id, false, reason);
    } else if (targetRole) {
      await onChangeRole(user.id, targetRole, reason);
    }
  };

  const isAdmin = currentUserRole === 'admin';

  return (
    <div className="border border-metal-border bg-pit-grease p-4 shadow-beveled-panel">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-xs">
          <thead>
            <tr className="border-b border-metal-border font-mono uppercase tracking-wider text-readout-muted">
              <th className="pb-2">Driver</th>
              <th className="pb-2">Role</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Garage Fleet</th>
              <th className="pb-2">Joined</th>
              <th className="pb-2 text-right">Moderation Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-metal-border/50">
            {users.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-readout-muted">
                  No drivers matched the active filters.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="hover:bg-pit-steel/30">
                  <td className="py-3">
                    <div className="font-mono font-bold text-readout-bright">
                      @{u.callsign}
                    </div>
                    <div className="text-[11px] text-readout-dim">{u.email}</div>
                    {u.suspensionReason && (
                      <div className="mt-1 font-mono text-[10px] text-hazard-orange">
                        Reason: {u.suspensionReason}
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'border-hazard-orange bg-hazard-orange/10 text-hazard-orange'
                          : u.role === 'moderator'
                          ? 'border-nitromethane bg-nitromethane/10 text-nitromethane'
                          : 'border-metal-border bg-pit-black/40 text-readout-dim'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3">
                    {u.isSuspended ? (
                      <span className="flex items-center gap-1.5 font-mono text-hazard-orange">
                        <span className="h-2 w-2 rounded-full bg-hazard-orange" />
                        Suspended
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 font-mono text-neon-radio">
                        <span className="h-2 w-2 rounded-full bg-neon-radio" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-3 font-mono text-readout-dim">
                    {u.vehicleCount} vehicles / {u.setupCount} setups
                  </td>
                  <td className="py-3 font-mono text-readout-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Suspension Toggle */}
                      <button
                        type="button"
                        onClick={() => handleOpenSuspend(u)}
                        disabled={isActionLoading}
                        className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                          u.isSuspended
                            ? 'border-neon-radio bg-neon-radio/10 text-neon-radio hover:bg-neon-radio/20'
                            : 'border-hazard-orange bg-hazard-orange/10 text-hazard-orange hover:bg-hazard-orange/20'
                        }`}
                      >
                        {u.isSuspended ? 'Reinstate' : 'Suspend'}
                      </button>

                      {/* Admin-only Role Controls */}
                      {isAdmin && !isSelf && (
                        <div className="flex gap-1">
                          {u.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleOpenRoleChange(u, 'admin')}
                              className="border border-metal-border bg-pit-steel px-2 py-1 font-mono text-[10px] uppercase text-readout-dim hover:text-readout-bright hover:border-metal-highlight"
                              title="Promote to Administrator"
                            >
                              +Admin
                            </button>
                          )}
                          {u.role !== 'moderator' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenRoleChange(u, 'moderator')
                              }
                              className="border border-metal-border bg-pit-steel px-2 py-1 font-mono text-[10px] uppercase text-readout-dim hover:text-readout-bright hover:border-metal-highlight"
                              title="Set as Moderator"
                            >
                              +Mod
                            </button>
                          )}
                          {u.role !== 'driver' && (
                            <button
                              type="button"
                              onClick={() => handleOpenRoleChange(u, 'driver')}
                              className="border border-metal-border bg-pit-steel px-2 py-1 font-mono text-[10px] uppercase text-hazard-orange/80 hover:text-hazard-orange hover:border-hazard-orange"
                              title="Demote to Driver"
                            >
                              Demote
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
            {isLoading ? 'Loading Drivers...' : 'Load More Drivers'}
          </button>
        </div>
      )}

      <ModerationActionModal
        isOpen={modalState.isOpen}
        title={
          modalState.action === 'suspend'
            ? 'Suspend Driver Account'
            : modalState.action === 'reinstate'
            ? 'Reinstate Driver Account'
            : `Update Driver Role to ${modalState.targetRole}`
        }
        description={
          modalState.action === 'suspend'
            ? 'Suspended drivers cannot log in, create setups, or participate in the community.'
            : modalState.action === 'reinstate'
            ? 'Reinstating this driver restores access to authentication and community features.'
            : `Changing driver role grants or revokes administrative control plane privileges.`
        }
        targetName={`@${modalState.user?.callsign ?? ''}`}
        actionLabel={
          modalState.action === 'suspend'
            ? 'Confirm Suspension'
            : modalState.action === 'reinstate'
            ? 'Confirm Reinstatement'
            : 'Confirm Role Change'
        }
        danger={modalState.action === 'suspend'}
        requireReason={modalState.action === 'suspend'}
        isLoading={isActionLoading}
        error={actionError}
        onConfirm={handleModalConfirm}
        onClose={() => setModalState({ isOpen: false, user: null, action: 'suspend' })}
      />
    </div>
  );
}
