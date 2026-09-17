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
  });
});
