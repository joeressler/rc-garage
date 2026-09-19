import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedComments, SetupComment } from '../../api/comments';
import { useAuthStore } from '../../stores/useAuthStore';
import { SetupCommentsPanel } from './SetupCommentsPanel';

function envelope<T>(data: T, statusCode = 200) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-19T00:00:00.000Z',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const COMMENT: SetupComment = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  setupId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  body: 'Drop the sway bar for the ledge.',
  createdAt: '2026-09-19T12:00:00.000Z',
  author: { callsign: 'TrailBoss', avatarUrl: null },
  isAuthor: false,
};

const PAGE: PaginatedComments = {
  items: [COMMENT],
  nextCursor: null,
  hasMore: false,
};

function renderPanel(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('SetupCommentsPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides the composer for guests and still renders listed bodies', async () => {
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(envelope(PAGE))),
    );

    const onRequestAuth = vi.fn();
    renderPanel(
      <SetupCommentsPanel
        setupId={COMMENT.setupId}
        onRequestAuth={onRequestAuth}
        onReportComment={vi.fn()}
      />,
    );

    expect(await screen.findByText('Drop the sway bar for the ledge.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pit Notes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Post note/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sign in to post a pit note/i }));
    expect(onRequestAuth).toHaveBeenCalledTimes(1);
  });

  it('shows the composer for an authenticated session', async () => {
    useAuthStore.setState({
      token: 'jwt-driver',
      user: {
        id: 'driver-1',
        callsign: 'RockHound',
        email: 'hound@example.com',
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
      vi.fn(async () => jsonResponse(envelope(PAGE))),
    );

    renderPanel(
      <SetupCommentsPanel
        setupId={COMMENT.setupId}
        onRequestAuth={vi.fn()}
        onReportComment={vi.fn()}
      />,
    );

    expect(await screen.findByText('Drop the sway bar for the ledge.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Post note/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign in to post a pit note/i })).not.toBeInTheDocument();
  });

  it('posts a note and refreshes the list', async () => {
    useAuthStore.setState({
      token: 'jwt-driver',
      user: {
        id: 'driver-1',
        callsign: 'RockHound',
        email: 'hound@example.com',
        role: 'driver',
        isSuspended: false,
        vehicleCount: 0,
        setupCount: 0,
        createdAt: '2026-09-19T00:00:00.000Z',
      },
      isAuthenticated: true,
    });

    const created: SetupComment = {
      ...COMMENT,
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      body: 'Packed the rear 10mm.',
      author: { callsign: 'RockHound', avatarUrl: null },
      isAuthor: true,
    };
    let posted = false;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posted = true;
          return jsonResponse(envelope(created, 201), 201);
        }
        if (posted) {
          return jsonResponse(
            envelope({
              items: [COMMENT, created],
              nextCursor: null,
              hasMore: false,
            }),
          );
        }
        return jsonResponse(envelope(PAGE));
      }),
    );

    renderPanel(
      <SetupCommentsPanel
        setupId={COMMENT.setupId}
        onRequestAuth={vi.fn()}
        onReportComment={vi.fn()}
      />,
    );

    expect(await screen.findByText('Drop the sway bar for the ledge.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Packed the rear 10mm.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Post note/i }));

    await waitFor(() => {
      expect(screen.getByText('Packed the rear 10mm.')).toBeInTheDocument();
    });
  });
});
