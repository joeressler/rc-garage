import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem, PaginatedNotifications } from '../../api/notifications';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { NotificationBell } from './NotificationBell';

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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="loc">{`${location.pathname}${location.search}`}</div>;
}

const LIKE: NotificationItem = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'like',
  createdAt: '2026-09-19T12:00:00.000Z',
  readAt: null,
  actorCallsign: 'RockHound',
  setupTitle: 'Moab Spec',
  setupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  qrSlug: 'slug12345',
  bodyPreview: null,
};

const REPORT: NotificationItem = {
  id: '22222222-2222-4222-8222-222222222222',
  type: 'report_outcome',
  createdAt: '2026-09-19T12:05:00.000Z',
  readAt: null,
  actorCallsign: 'Marshal',
  setupTitle: 'Moab Spec',
  setupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  qrSlug: 'slug12345',
  bodyPreview: 'dismissed',
};

function page(items: NotificationItem[], unreadCount: number): PaginatedNotifications {
  return {
    items,
    nextCursor: null,
    hasMore: false,
    unreadCount,
  };
}

function renderBell() {
  return render(
    <MemoryRouter>
      <LocationProbe />
      <NotificationBell />
    </MemoryRouter>,
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'jwt-driver',
      user: {
        id: 'driver-1',
        callsign: 'TrailBoss',
        email: 'trailboss@example.com',
        role: 'driver',
        isSuspended: false,
        createdAt: '2026-09-19T00:00:00.000Z',
        vehicleCount: 1,
        setupCount: 1,
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    useNotificationStore.getState().reset();
  });

  afterEach(() => {
    useNotificationStore.getState().reset();
    vi.unstubAllGlobals();
  });

  it('caps the unread badge at 99+', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/notifications/unread-count')) {
          return jsonResponse(envelope({ unreadCount: 120 }));
        }
        if (url.includes('/notifications') && !url.includes('/read')) {
          return jsonResponse(envelope(page([], 120)));
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    renderBell();
    expect(await screen.findByText('99+')).toBeInTheDocument();
  });

  it('shows empty copy when the inbox has no pit signals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/notifications/unread-count')) {
          return jsonResponse(envelope({ unreadCount: 0 }));
        }
        if (url.includes('/notifications') && !url.includes('/read')) {
          return jsonResponse(envelope(page([], 0)));
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /pit signals/i }));
    expect(await screen.findByText('No pit signals')).toBeInTheDocument();
  });

  it('navigates like rows to feed inspect and keeps report outcomes in the panel', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/notifications/unread-count')) {
        return jsonResponse(envelope({ unreadCount: 2 }));
      }
      if (url.includes('/notifications/read')) {
        return jsonResponse(envelope({ unreadCount: 1 }));
      }
      if (url.includes('/notifications')) {
        return jsonResponse(envelope(page([LIKE, REPORT], 2)));
      }
      throw new Error(`unexpected fetch ${url} ${init?.method}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /pit signals/i }));
    expect(await screen.findByText('RockHound liked Moab Spec')).toBeInTheDocument();
    expect(screen.getByText('Report dismissed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /RockHound liked Moab Spec/i }));
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe(
        `/feed?inspect=${LIKE.setupId}`,
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /pit signals/i }));
    expect(await screen.findByText('Report dismissed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Report dismissed/i }));
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe(
        `/feed?inspect=${LIKE.setupId}`,
      );
    });
  });
});
