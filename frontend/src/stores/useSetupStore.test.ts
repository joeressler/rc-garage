import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSetupSettings, type SetupEntity } from '../api/setups';
import { useAuthStore } from './useAuthStore';
import { useGarageStore, type Vehicle } from './useGarageStore';
import { useSetupStore } from './useSetupStore';

const TOKEN = 'test-jwt-token';

const VEHICLE: Vehicle = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: '11111111-1111-4111-8111-111111111111',
  name: 'Phoenix Trail Rig',
  make: 'Vanquish',
  model: 'VS4-10 Phoenix',
  scale: '1/10',
  vehicleClass: 'crawler_scale',
  isArchived: false,
  electronics: {},
  setupCount: 1,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

const VEHICLE_B: Vehicle = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: VEHICLE.userId,
  name: 'Capra Trail Rig',
  make: 'Axial',
  model: 'Capra',
  scale: '1/10',
  vehicleClass: 'crawler_scale',
  isArchived: false,
  electronics: {},
  setupCount: 1,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

const SAVED_SETUP: SetupEntity = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  vehicleId: VEHICLE.id,
  userId: VEHICLE.userId,
  title: 'Rubicon Trail Low-CoG Comp Spec',
  description: 'Test notes',
  isPublic: true,
  tags: ['comp', 'crawler'],
  qrSlug: 'v9k2pq1x8m',
  calculatedFdr: 10.03,
  frontBiasPercentage: 60.0,
  surfaceType: 'granite_rock',
  locationTag: 'Moab Rim',
  settings: defaultSetupSettings(),
  forkCount: 0,
  likeCount: 0,
  forkedFromSetupId: null,
  rootAncestorSetupId: null,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

const CAPRA_SETUP: SetupEntity = {
  ...SAVED_SETUP,
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  vehicleId: VEHICLE_B.id,
  title: 'Capra Night Practice',
  qrSlug: 'capra1x8m2',
  calculatedFdr: 9.45,
};

function envelope<T>(data: T, statusCode = 200) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-16T00:00:00.000Z',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resetStores(): void {
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
  useGarageStore.getState().reset();
  useSetupStore.getState().reset();
}

describe('useSetupStore', () => {
  beforeEach(() => {
    resetStores();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('unexpected fetch'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStores();
  });

  it('recalculates FDR in real time when pinion, spur, or internal ratio updates', () => {
    // 14 Pinion, 54 Spur, 2.6 ratio -> (54 / 14) * 2.6 = 10.03
    useSetupStore.getState().updateGearing(14, 54, 2.6);
    expect(useSetupStore.getState().activeSettings.drivetrain.calculatedFdr).toBe(10.03);
    expect(useSetupStore.getState().isDirty).toBe(true);

    // Change pinion to 12T -> (54 / 12) * 2.6 = 11.7
    useSetupStore.getState().updateGearing(12, 54, 2.6);
    expect(useSetupStore.getState().activeSettings.drivetrain.calculatedFdr).toBe(11.7);
  });

  it('accepts Losi LMT 10.16:1 internal ratio and stamps FDR', () => {
    // (35 / 19) * 10.16 = 18.72
    useSetupStore.getState().updateGearing(19, 35, 10.16);
    expect(useSetupStore.getState().activeSettings.drivetrain.calculatedFdr).toBe(18.72);
    expect(
      useSetupStore.getState().validationErrors['settings.drivetrain.transmissionInternalRatio'],
    ).toBeUndefined();
  });

  it('flags an inline validation error if spur teeth <= pinion teeth', () => {
    useSetupStore.getState().updateGearing(40, 35, 2.6);
    const errors = useSetupStore.getState().validationErrors;
    expect(errors['settings.drivetrain.spurTeeth']).toMatch(/must exceed pinion/i);

    // Fix it
    useSetupStore.getState().updateGearing(15, 54, 2.6);
    expect(useSetupStore.getState().validationErrors['settings.drivetrain.spurTeeth']).toBeUndefined();
  });

  it('recalculates total RTR weight and CoG front/rear bias percentages instantaneously', () => {
    // Front: 1500g, Rear: 1000g -> Total 2500g, Front: 60.0%, Rear: 40.0%
    useSetupStore.getState().updateWeights(1500, 1000);
    const weight = useSetupStore.getState().activeSettings.tiresAndWeight.weight;
    expect(weight.totalRtrWeightGrams).toBe(2500);
    expect(weight.frontWeightBiasPercentage).toBe(60.0);
    expect(weight.rearWeightBiasPercentage).toBe(40.0);
  });

  it('updates suspension corner specs for front and rear axles independently', () => {
    useSetupStore.getState().updateSuspensionCorner('front', {
      oilViscosityValue: 450,
      camberAngleDeg: -2.0,
      toeAngleDeg: 1.5,
    });
    expect(useSetupStore.getState().activeSettings.suspension.front.oilViscosityValue).toBe(450);
    expect(useSetupStore.getState().activeSettings.suspension.front.camberAngleDeg).toBe(-2.0);
    expect(useSetupStore.getState().activeSettings.suspension.front.toeAngleDeg).toBe(1.5);
    // Rear remains untouched
    expect(useSetupStore.getState().activeSettings.suspension.rear.camberAngleDeg).toBe(0.0);
  });

  it('fails saveCurrentSetup if no token exists', async () => {
    useSetupStore.getState().setTargetVehicleId(VEHICLE.id);
    await expect(useSetupStore.getState().saveCurrentSetup()).rejects.toThrow(/sign in/i);
  });

  it('saves a new setup sheet, assigns qrSlug, and updates store state', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });
    useSetupStore.getState().setTargetVehicleId(VEHICLE.id);

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(SAVED_SETUP, 201)));

    const saved = await useSetupStore.getState().saveCurrentSetup();

    expect(saved.qrSlug).toBe('v9k2pq1x8m');
    expect(useSetupStore.getState().activeSetup?.id).toBe(SAVED_SETUP.id);
    expect(useSetupStore.getState().isDirty).toBe(false);
    expect(useSetupStore.getState().isSaving).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      '/api/garage/setups',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      }),
    );
  });

  it('updates existing setup sheet via PUT when activeSetup already has an id', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    // Set initial active setup
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      targetVehicleId: VEHICLE.id,
      meta: {
        title: SAVED_SETUP.title,
        description: SAVED_SETUP.description ?? '',
        isPublic: SAVED_SETUP.isPublic,
        tags: SAVED_SETUP.tags,
      },
    });

    const updatedEntity = { ...SAVED_SETUP, title: 'Updated Spec' };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(updatedEntity, 200)));

    useSetupStore.getState().updateMeta({ title: 'Updated Spec' });
    const saved = await useSetupStore.getState().saveCurrentSetup();

    expect(saved.title).toBe('Updated Spec');
    expect(fetch).toHaveBeenCalledWith(
      `/api/garage/setups/${SAVED_SETUP.id}`,
      expect.objectContaining({
        method: 'PUT',
      }),
    );
    const updateBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body ?? '{}'),
    ) as { vehicleId?: string };
    expect(updateBody.vehicleId).toBeUndefined();
  });

  it('saves a sheet that uses a custom internal ratio and edited shock/tire values', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });
    useSetupStore.getState().setTargetVehicleId(VEHICLE.id);
    useSetupStore.getState().updateGearing(14, 54, 3.25);
    useSetupStore.getState().updateSuspensionCorner('front', {
      oilViscosityValue: 400,
      springRateDescription: '1.8 lb/in',
      rideHeightMm: 70,
    });
    useSetupStore.getState().updateTires('front', { compound: 'Sticky' });

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(SAVED_SETUP, 201)));

    await expect(useSetupStore.getState().saveCurrentSetup()).resolves.toMatchObject({
      qrSlug: 'v9k2pq1x8m',
    });
  });

  it('saves a custom ratio when loaded telemetry has null hidden fields', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    const loaded = defaultSetupSettings();
    const dirty = {
      ...loaded,
      drivetrain: {
        ...loaded.drivetrain,
        motorKv: null,
        transmissionInternalRatio: '2.6',
      },
      suspension: {
        ...loaded.suspension,
        portalBoxRatio: null,
        front: { ...loaded.suspension.front, springRateLbsInch: null },
        rear: { ...loaded.suspension.rear, shockLengthEyeToEyeMm: undefined },
      },
      trackConditions: {
        ...loaded.trackConditions,
        locationTag: null,
        ambientTempCelsius: null,
      },
      driverNotes: null,
    };

    useSetupStore.setState({
      activeSettings: dirty as unknown as SetupEntity['settings'],
      targetVehicleId: VEHICLE.id,
      meta: {
        title: 'Custom Ratio Spec',
        description: '',
        isPublic: true,
        tags: [],
      },
    });
    useSetupStore.getState().updateGearing(14, 54, 3.25);
    useSetupStore.getState().updateSuspensionCorner('front', {
      oilViscosityValue: 400,
      springRateDescription: '1.8 lb/in',
    });
    useSetupStore.getState().updateTires('front', { compound: 'Sticky' });

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(SAVED_SETUP, 201)));

    await expect(useSetupStore.getState().saveCurrentSetup()).resolves.toMatchObject({
      qrSlug: 'v9k2pq1x8m',
    });
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body ?? '{}')) as {
      settings: { drivetrain: { transmissionInternalRatio: number; calculatedFdr: number } };
    };
    expect(body.settings.drivetrain.transmissionInternalRatio).toBe(3.25);
    expect(body.settings.drivetrain.calculatedFdr).toBe(12.54);
  });

  it('keeps field-level messages when save validation fails on shock or tire inputs', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });
    useSetupStore.getState().setTargetVehicleId(VEHICLE.id);
    useSetupStore.getState().updateGearing(14, 54, 3.25);
    useSetupStore.getState().updateSuspensionCorner('front', { springRateDescription: '' });
    useSetupStore.getState().updateTires('rear', { compound: '' });

    await expect(useSetupStore.getState().saveCurrentSetup()).rejects.toThrow(/Validation failed/);
    const errors = useSetupStore.getState().validationErrors;
    expect(errors['settings.suspension.front.springRateDescription']).toMatch(/spring rate/i);
    expect(errors['settings.tiresAndWeight.rear.compound']).toMatch(/compound/i);
    expect(useSetupStore.getState().error).toMatch(/highlighted telemetry/i);
  });

  it('creates a new sheet when the editor is pointed at a different chassis', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [VEHICLE, VEHICLE_B],
      activeVehicleId: VEHICLE_B.id,
    });
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      targetVehicleId: VEHICLE_B.id,
      meta: {
        title: SAVED_SETUP.title,
        description: SAVED_SETUP.description ?? '',
        isPublic: SAVED_SETUP.isPublic,
        tags: SAVED_SETUP.tags,
      },
    });

    const created = { ...CAPRA_SETUP, id: 'new-setup-uuid', title: SAVED_SETUP.title };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(created, 201)));

    const saved = await useSetupStore.getState().saveCurrentSetup();

    expect(saved.id).toBe('new-setup-uuid');
    expect(fetch).toHaveBeenCalledWith(
      '/api/garage/setups',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const createBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body ?? '{}'),
    ) as { vehicleId?: string };
    expect(createBody.vehicleId).toBe(VEHICLE_B.id);
  });

  it('loads the latest spec for a chassis or starts a draft when none exist', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [VEHICLE, VEHICLE_B],
      activeVehicleId: VEHICLE.id,
    });
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      targetVehicleId: VEHICLE.id,
      meta: {
        title: SAVED_SETUP.title,
        description: SAVED_SETUP.description ?? '',
        isPublic: SAVED_SETUP.isPublic,
        tags: SAVED_SETUP.tags,
      },
    });

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes(`vehicleId=${VEHICLE_B.id}`)) {
        return jsonResponse(
          envelope([
            {
              id: CAPRA_SETUP.id,
              vehicleId: CAPRA_SETUP.vehicleId,
              userId: CAPRA_SETUP.userId,
              title: CAPRA_SETUP.title,
              isPublic: CAPRA_SETUP.isPublic,
              calculatedFdr: CAPRA_SETUP.calculatedFdr,
              frontBiasPercentage: CAPRA_SETUP.frontBiasPercentage,
              surfaceType: CAPRA_SETUP.surfaceType,
              forkCount: CAPRA_SETUP.forkCount,
              likeCount: CAPRA_SETUP.likeCount,
              qrSlug: CAPRA_SETUP.qrSlug,
              isForked: false,
              createdAt: CAPRA_SETUP.createdAt,
            },
          ]),
        );
      }
      if (url.includes(`/api/garage/setups/${CAPRA_SETUP.id}`)) {
        return jsonResponse(envelope(CAPRA_SETUP));
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    });

    const loaded = await useSetupStore.getState().activateChassis(VEHICLE_B.id);
    expect(useSetupStore.getState().error).toBeNull();
    expect(loaded?.id).toBe(CAPRA_SETUP.id);
    expect(useSetupStore.getState().activeSetup?.vehicleId).toBe(VEHICLE_B.id);

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(`vehicleId=${VEHICLE.id}`)) {
        return jsonResponse(envelope([]));
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const drafted = await useSetupStore.getState().activateChassis(VEHICLE.id);
    expect(drafted).toBeNull();
    expect(useSetupStore.getState().activeSetup).toBeNull();
    expect(useSetupStore.getState().targetVehicleId).toBe(VEHICLE.id);
    expect(useSetupStore.getState().meta.title).toBe('Vanquish VS4-10 Phoenix Spec');
  });

  it('fetches community feed and tracks pagination cursor', async () => {
    const feedItem = {
      id: 'feed-setup-1',
      title: 'Community Rig Spec',
      author: { callsign: 'TrailBoss', avatarUrl: null },
      vehicle: { make: 'Element', model: 'Enduro', class: 'crawler_scale' as const },
      calculatedFdr: 10.5,
      frontBiasPercentage: 58.0,
      surfaceType: 'granite_rock' as const,
      forkCount: 5,
      likeCount: 12,
      isLikedByCaller: false,
      qrSlug: 'slug123',
      createdAt: '2026-09-17T00:00:00Z',
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        envelope({
          items: [feedItem],
          nextCursor: 'next-uuid',
          hasMore: true,
        }),
      ),
    );

    await useSetupStore.getState().fetchFeed(true);

    expect(useSetupStore.getState().feedSetups).toHaveLength(1);
    expect(useSetupStore.getState().feedSetups[0]?.title).toBe('Community Rig Spec');
    expect(useSetupStore.getState().feedNextCursor).toBe('next-uuid');
    expect(useSetupStore.getState().feedHasMore).toBe(true);
  });

  it('toggles like atomically on a feed setup item', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });

    const feedItem = {
      id: 'feed-setup-1',
      title: 'Community Rig Spec',
      author: { callsign: 'TrailBoss', avatarUrl: null },
      vehicle: { make: 'Element', model: 'Enduro', class: 'crawler_scale' as const },
      calculatedFdr: 10.5,
      frontBiasPercentage: 58.0,
      surfaceType: 'granite_rock' as const,
      forkCount: 5,
      likeCount: 12,
      isLikedByCaller: false,
      qrSlug: 'slug123',
      createdAt: '2026-09-17T00:00:00Z',
    };

    useSetupStore.setState({ feedSetups: [feedItem] });

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        envelope({
          liked: true,
          likeCount: 13,
        }),
      ),
    );

    await useSetupStore.getState().toggleLike('feed-setup-1');

    expect(useSetupStore.getState().feedSetups[0]?.isLikedByCaller).toBe(true);
    expect(useSetupStore.getState().feedSetups[0]?.likeCount).toBe(13);
  });

  it('forks setup into user garage and updates active setup', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    const forkedEntity: SetupEntity = {
      ...SAVED_SETUP,
      id: 'forked-setup-uuid',
      title: 'Fork of Moab Spec',
      forkedFromSetupId: 'source-setup-uuid',
    };

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(forkedEntity, 201)));

    const result = await useSetupStore
      .getState()
      .forkSetupIntoGarage('source-setup-uuid', VEHICLE.id, 'Fork of Moab Spec');

    expect(result.id).toBe('forked-setup-uuid');
    expect(useSetupStore.getState().activeSetup?.id).toBe('forked-setup-uuid');
    expect(fetch).toHaveBeenCalledWith(
      '/api/garage/setups/source-setup-uuid/fork',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
