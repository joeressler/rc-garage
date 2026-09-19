import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';

const TOKEN = 'test-jwt-token';
const PROFILE = {
  id: '11111111-1111-4111-8111-111111111111',
  callsign: 'TrailBoss',
  email: 'trailboss@example.com',
  role: 'driver' as const,
  isSuspended: false,
  createdAt: '2026-09-16T00:00:00.000Z',
};

function envelope<T>(data: T, statusCode = 200) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-16T00:00:00.000Z',
  };
}

function resetAuthStore(): void {
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
  window.localStorage.removeItem('rc-garage-auth');
}

describe('useAuthStore', () => {
  beforeEach(() => {
    resetAuthStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('unexpected fetch'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthStore();
  });

  it('persists the JWT token across login and keeps isAuthenticated true', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ token: TOKEN, user: PROFILE }, 200)),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope({ ...PROFILE, vehicleCount: 4, setupCount: 7 }),
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await useAuthStore.getState().login({
      email: 'trailboss@example.com',
      password: 'supersecret',
    });

    const state = useAuthStore.getState();
    expect(state.token).toBe(TOKEN);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.callsign).toBe('TrailBoss');
    expect(state.user?.vehicleCount).toBe(4);

    const persisted = JSON.parse(
      window.localStorage.getItem('rc-garage-auth') ?? '{}',
    ) as { state?: { token?: string; user?: unknown } };
    expect(persisted.state?.token).toBe(TOKEN);
    expect(persisted.state?.user).toBeUndefined();
  });

  it('wipes token and identity immediately on logout', async () => {
    useAuthStore.setState({
      token: TOKEN,
      user: { ...PROFILE, vehicleCount: 1, setupCount: 0 },
      isAuthenticated: true,
    });
    window.localStorage.setItem(
      'rc-garage-auth',
      JSON.stringify({ state: { token: TOKEN }, version: 0 }),
    );

    useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      isAuthenticated: false,
    });
    const persisted = JSON.parse(
      window.localStorage.getItem('rc-garage-auth') ?? '{}',
    ) as { state?: { token?: string | null } };
    expect(persisted.state?.token).toBeNull();
  });

  it('restores the driver profile from a persisted token via checkSession', async () => {
    window.localStorage.setItem(
      'rc-garage-auth',
      JSON.stringify({ state: { token: TOKEN }, version: 0 }),
    );
    useAuthStore.setState({ token: TOKEN, user: null, isAuthenticated: true });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          envelope({ ...PROFILE, vehicleCount: 2, setupCount: 3 }),
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await useAuthStore.getState().checkSession();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.setupCount).toBe(3);
    expect(fetch).toHaveBeenCalledWith(
      '/api/garage/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      }),
    );
  });

  it('clears a stale token when checkSession is rejected', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          error: 'Unauthorized',
          message: ['Unauthorized'],
          timestamp: '2026-09-16T00:00:00.000Z',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await useAuthStore.getState().checkSession();

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('registers with ageAttested and persists only the JWT in localStorage', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ token: TOKEN, user: PROFILE }, 201)),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope({ ...PROFILE, vehicleCount: 0, setupCount: 0 }),
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await useAuthStore.getState().register({
      email: 'trailboss@example.com',
      password: 'password123',
      callsign: 'TrailBoss',
      ageAttested: true,
      acceptedLegal: true,
      recaptchaToken: 'dev-bypass',
    });

    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/garage/auth/register');
    expect(JSON.parse(String(init.body))).toMatchObject({
      ageAttested: true,
      acceptedLegal: true,
      recaptchaToken: 'dev-bypass',
    });
    expect(window.localStorage.getItem('rc-garage-auth')).toContain(TOKEN);
    expect(document.cookie).toBe('');

    const persisted = JSON.parse(
      window.localStorage.getItem('rc-garage-auth') ?? '{}',
    ) as { state?: { token?: string; user?: unknown } };
    expect(persisted.state?.token).toBe(TOKEN);
    expect(persisted.state?.user).toBeUndefined();
  });
});
