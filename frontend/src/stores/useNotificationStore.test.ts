import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';
import { useNotificationStore } from './useNotificationStore';

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

describe('useNotificationStore', () => {
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
        vehicleCount: 0,
        setupCount: 0,
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    useNotificationStore.getState().reset();
  });

  afterEach(() => {
    useNotificationStore.getState().reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  it('polls unread-count over REST and never opens a WebSocket', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/notifications/unread-count')) {
        return jsonResponse(envelope({ unreadCount: 3 }));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const webSocket = vi.fn();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocket);

    useNotificationStore.getState().startPolling();
    await vi.waitFor(() => {
      expect(useNotificationStore.getState().unreadCount).toBe(3);
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/notifications/unread-count');
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(setIntervalSpy.mock.calls[0]?.[1]).toBe(60_000);

    const tick = setIntervalSpy.mock.calls[0]?.[0] as () => void;
    tick();
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(
      fetchMock.mock.calls.every((call) => String(call[0]).includes('/notifications/unread-count')),
    ).toBe(true);
    expect(webSocket).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    const callsWhileVisible = fetchMock.mock.calls.length;
    tick();
    expect(fetchMock.mock.calls.length).toBe(callsWhileVisible);

    useNotificationStore.getState().stopPolling();
  });
});
