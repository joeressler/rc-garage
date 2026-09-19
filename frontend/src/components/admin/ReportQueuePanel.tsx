import { useState } from 'react';
import type { AdminReportStatus, AdminReportSummary } from '../../api/admin';

interface ReportQueuePanelProps {
  reports: AdminReportSummary[];
  hasMore: boolean;
  isLoading: boolean;
  isActionLoading: boolean;
  actionError: string | null;
  onLoadMore: () => void;
  onResolve: (
    reportId: string,
    payload: {
      status: 'actioned' | 'dismissed';
      reason: string;
      hideSetup?: boolean;
      hideComment?: boolean;
      suspendUser?: boolean;
    },
  ) => Promise<unknown>;
}

const STATUS_CLASS: Record<AdminReportStatus, string> = {
  open: 'border-nitromethane text-nitromethane',
  dismissed: 'border-neon-radio text-neon-radio',
  actioned: 'border-hazard-orange text-hazard-orange',
};

/**
 * Purpose: let Scrutineering Desk operators action or dismiss the driver report queue without a second admin app.
 */
export function ReportQueuePanel({
  reports,
  hasMore,
  isLoading,
  isActionLoading,
  actionError,
  onLoadMore,
  onResolve,
}: ReportQueuePanelProps) {
  const [reason, setReason] = useState('');
  const [hideSetup, setHideSetup] = useState(true);
  const [hideComment, setHideComment] = useState(true);
  const [suspendUser, setSuspendUser] = useState(false);

  const handleResolve = async (
    report: AdminReportSummary,
    status: 'actioned' | 'dismissed',
  ) => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      return;
    }
    await onResolve(report.id, {
      status,
      reason: trimmed,
      hideSetup: status === 'actioned' && report.targetType === 'setup' ? hideSetup : undefined,
      hideComment:
        status === 'actioned' && report.targetType === 'comment' ? hideComment : undefined,
      suspendUser: status === 'actioned' ? suspendUser : undefined,
    });
    setReason('');
  };

  return (
    <section className="space-y-3">
      {actionError ? (
        <p className="border border-nitromethane/50 bg-nitromethane/10 p-2 font-mono text-xs text-nitromethane">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 border border-metal-border bg-pit-black/40 p-3">
        <label className="flex-1 min-w-[16rem]">
          <span className="block font-mono text-[10px] uppercase tracking-widest text-readout-muted">
            Resolve reason
          </span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-readout-dim">
          <input
            type="checkbox"
            checked={hideSetup}
            onChange={(event) => setHideSetup(event.target.checked)}
          />
          Hide setup
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-readout-dim">
          <input
            type="checkbox"
            checked={hideComment}
            onChange={(event) => setHideComment(event.target.checked)}
          />
          Hide comment
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-readout-dim">
          <input
            type="checkbox"
            checked={suspendUser}
            onChange={(event) => setSuspendUser(event.target.checked)}
          />
          Suspend user
        </label>
      </div>

      <div className="overflow-x-auto border border-metal-border">
        <table className="w-full text-left">
          <thead className="bg-pit-grease font-mono text-[10px] uppercase tracking-widest text-readout-muted">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Reporter</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} className="border-t border-metal-border/60">
                <td className="px-3 py-2">
                  <span
                    className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${STATUS_CLASS[report.status]}`}
                  >
                    {report.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-readout-bright">
                  {report.targetType} · {report.targetLabel}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-hazard-orange">
                  @{report.reporterCallsign}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-readout-dim">
                  {report.reasonCode}
                  {report.details ? ` — ${report.details}` : ''}
                </td>
                <td className="px-3 py-2">
                  {report.status === 'open' ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isActionLoading || reason.trim().length < 3}
                        onClick={() => void handleResolve(report, 'actioned')}
                        className="border border-hazard-orange px-2 py-1 font-display text-[10px] uppercase tracking-wider text-hazard-orange disabled:opacity-50"
                      >
                        Action
                      </button>
                      <button
                        type="button"
                        disabled={isActionLoading || reason.trim().length < 3}
                        onClick={() => void handleResolve(report, 'dismissed')}
                        className="border border-neon-radio px-2 py-1 font-display text-[10px] uppercase tracking-wider text-neon-radio disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-readout-muted">Resolved</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reports.length === 0 && !isLoading ? (
        <p className="font-mono text-xs text-readout-muted">No reports in this queue.</p>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoading}
          className="border border-hazard-orange bg-pit-black px-4 py-2 font-display text-xs uppercase tracking-widest text-hazard-orange"
        >
          Load more reports
        </button>
      ) : null}
    </section>
  );
}
