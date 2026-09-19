import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/useAuthStore';
import { ReportSetupModal } from './ReportSetupModal';

function envelope<T>(data: T, statusCode = 201) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-19T00:00:00.000Z',
  };
}

describe('ReportSetupModal', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'jwt-reporter',
      user: {
        id: 'reporter-1',
        callsign: 'Reporter',
        email: 'rep@example.com',
        role: 'driver',
        isSuspended: false,
        vehicleCount: 0,
        setupCount: 0,
        createdAt: '2026-09-19T00:00:00.000Z',
      },
      isAuthenticated: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify(envelope({ id: 'report-1', status: 'open' }, 201)),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a setup report with the selected reason', async () => {
    render(
      <ReportSetupModal
        open
        target={{
          targetType: 'setup',
          targetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          label: 'Moab Slickrock Spec',
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'spam' } });
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() =>
      expect(screen.getByText(/Report filed/i)).toBeInTheDocument(),
    );
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      targetType: 'setup',
      targetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      reasonCode: 'spam',
    });
  });
});
