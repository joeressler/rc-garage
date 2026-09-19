import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminReportSummary } from '../../api/admin';
import { ReportQueuePanel } from './ReportQueuePanel';

const OPEN_REPORT: AdminReportSummary = {
  id: 'report-1',
  reporterUserId: 'user-2',
  reporterCallsign: 'Watchdog',
  targetType: 'setup',
  targetId: 'setup-1',
  targetLabel: 'Spam Sheet',
  reasonCode: 'spam',
  details: null,
  status: 'open',
  createdAt: '2026-09-19T00:00:00.000Z',
  resolvedAt: null,
  resolvedByUserId: null,
};

describe('ReportQueuePanel', () => {
  it('actions an open report with hideSetup when the reason is filled', async () => {
    const onResolve = vi.fn().mockResolvedValue(OPEN_REPORT);
    render(
      <ReportQueuePanel
        reports={[OPEN_REPORT]}
        hasMore={false}
        isLoading={false}
        isActionLoading={false}
        actionError={null}
        onLoadMore={vi.fn()}
        onResolve={onResolve}
      />,
    );

    expect(screen.getByText('open')).toHaveClass('text-nitromethane');
    fireEvent.change(screen.getByLabelText(/resolve reason/i), {
      target: { value: 'Hide spam sheet' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^action$/i }));

    expect(onResolve).toHaveBeenCalledWith('report-1', {
      status: 'actioned',
      reason: 'Hide spam sheet',
      hideSetup: true,
      suspendUser: false,
    });
  });
});
