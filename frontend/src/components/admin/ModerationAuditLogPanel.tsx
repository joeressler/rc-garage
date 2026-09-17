import type { ModerationAuditLogEntry } from '../../api/admin';

interface ModerationAuditLogPanelProps {
  logs: ModerationAuditLogEntry[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}

/**
 * Purpose: display the immutable moderation audit trail in reverse chronological order.
 */
export function ModerationAuditLogPanel({
  logs,
  hasMore,
  isLoading,
  onLoadMore,
}: ModerationAuditLogPanelProps) {
  return (
    <div className="border border-metal-border bg-pit-grease p-4 shadow-beveled-panel">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-xs">
          <thead>
            <tr className="border-b border-metal-border font-mono uppercase tracking-wider text-readout-muted">
              <th className="pb-2">Timestamp</th>
              <th className="pb-2">Operator</th>
              <th className="pb-2">Action</th>
              <th className="pb-2">Target Type & ID</th>
              <th className="pb-2">Reason / Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-metal-border/50">
            {logs.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-readout-muted">
                  No moderation audit records recorded yet.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-pit-steel/30">
                <td className="py-3 font-mono text-[11px] text-readout-muted whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="py-3">
                  <div className="font-mono font-bold text-readout-bright">
                    @{log.actorCallsign}
                  </div>
                  <span
                    className={`inline-block border px-1.5 py-0.2 font-mono text-[9px] uppercase ${
                      log.actorRole === 'admin'
                        ? 'border-hazard-orange text-hazard-orange'
                        : 'border-nitromethane text-nitromethane'
                    }`}
                  >
                    {log.actorRole}
                  </span>
                </td>
                <td className="py-3">
                  <span
                    className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                      log.action.includes('suspend') || log.action.includes('delete')
                        ? 'border-hazard-orange bg-hazard-orange/10 text-hazard-orange'
                        : log.action.includes('reinstate') || log.action.includes('unhide')
                        ? 'border-neon-radio bg-neon-radio/10 text-neon-radio'
                        : 'border-nitromethane bg-nitromethane/10 text-nitromethane'
                    }`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="py-3 font-mono text-[11px] text-readout-dim">
                  <div className="uppercase tracking-wider text-[10px] text-readout-muted">
                    {log.targetType}
                  </div>
                  <div>{log.targetId}</div>
                </td>
                <td className="py-3">
                  <div className="font-sans text-xs text-readout-bright">
                    {log.reason || (
                      <span className="italic text-readout-muted">No reason given</span>
                    )}
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-1 font-mono text-[10px] text-readout-muted truncate max-w-xs">
                      {JSON.stringify(log.metadata)}
                    </div>
                  )}
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
            {isLoading ? 'Loading Audit Log...' : 'Load More Audit Entries'}
          </button>
        </div>
      )}
    </div>
  );
}
