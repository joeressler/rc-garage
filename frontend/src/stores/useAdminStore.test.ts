import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminStore } from './useAdminStore';
import { useAuthStore } from './useAuthStore';

function envelope<T>(data: T, statusCode = 200) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-17T00:00:00.000Z',
  };
}

const OVERVIEW = {
  userCount: 42,
  setupCount: 15,
  publicSetupCount: 12,
  hiddenSetupCount: 2,
  suspendedUserCount: 1,
  likes24h: 7,
};

const USER = {
  id: 'user-uuid-1',
  callsign: 'BadActor',
  email: 'bad@example.com',
  role: 'driver' as const,
  isSuspended: false,
  suspendedAt: null,
  suspensionReason: null,
  avatarUrl: null,
  bio: null,
  vehicleCount: 1,
  setupCount: 2,
  createdAt: '2026-09-17T00:00:00.000Z',
};

const SETUP = {
  id: 'setup-uuid-1',
  title: 'Abusive Setup',
  vehicleId: 'veh-1',
  userId: 'user-uuid-1',
  authorCallsign: 'BadActor',
  authorEmail: 'bad@example.com',
  vehicleName: 'Enduro',
  vehicleMake: 'Element',
  vehicleModel: 'Sendero',
  isPublic: true,
  isHidden: false,
  hiddenAt: null,
  hiddenReason: null,
  forkCount: 0,
  likeCount: 0,
  qrSlug: 'slug12345',
  surfaceType: 'slick_rock',
  calculatedFdr: 10.5,
  frontBiasPercentage: 60,
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
};

describe('useAdminStore', () => {
  beforeEach(() => {
    useAdminStore.getState().reset();
    useAuthStore.setState({
      token: 'jwt-admin-token',
      user: {
        id: 'admin-uuid',
        callsign: 'AdminBoss',
        email: 'admin@example.com',
        role: 'admin',
        isSuspended: false,
        vehicleCount: 0,
        setupCount: 0,
        createdAt: '2026-09-17T00:00:00.000Z',
      },
      isAuthenticated: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('unexpected fetch'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAdminStore.getState().reset();
  });

  it('fetches overview KPIs successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(envelope(OVERVIEW)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await useAdminStore.getState().fetchOverview();
    expect(useAdminStore.getState().overview).toEqual(OVERVIEW);
    expect(useAdminStore.getState().error).toBeNull();
  });

  it('suspends a user and updates state', async () => {
    useAdminStore.setState({ users: [USER] });

    const suspendedUser = {
      ...USER,
      isSuspended: true,
      suspensionReason: 'Terms violation',
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(envelope(suspendedUser)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      // fetchOverview and fetchAuditLog background calls
      .mockResolvedValue(
        new Response(
          JSON.stringify(envelope({ items: [], nextCursor: null, hasMore: false })),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await useAdminStore
      .getState()
      .suspendUser('user-uuid-1', true, 'Terms violation');

    expect(useAdminStore.getState().users[0]?.isSuspended).toBe(true);
    expect(useAdminStore.getState().users[0]?.suspensionReason).toBe(
      'Terms violation',
    );
  });

  it('hides a setup sheet and updates state', async () => {
    useAdminStore.setState({ setups: [SETUP] });

    const hiddenSetup = {
      ...SETUP,
      isHidden: true,
      hiddenReason: 'Spam content',
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(envelope(hiddenSetup)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify(envelope({ items: [], nextCursor: null, hasMore: false })),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await useAdminStore
      .getState()
      .toggleSetupVisibility('setup-uuid-1', true, 'Spam content');

    expect(useAdminStore.getState().setups[0]?.isHidden).toBe(true);
    expect(useAdminStore.getState().setups[0]?.hiddenReason).toBe('Spam content');
  });

  it('deletes a setup sheet and removes from state', async () => {
    useAdminStore.setState({ setups: [SETUP] });

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ deleted: true, id: 'setup-uuid-1' })),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify(envelope({ items: [], nextCursor: null, hasMore: false })),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await useAdminStore
      .getState()
      .deleteSetup('setup-uuid-1', 'Abusive content hard delete');

    expect(useAdminStore.getState().setups.length).toBe(0);
  });
});
