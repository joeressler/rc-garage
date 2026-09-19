import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';
import { useGarageStore, type Vehicle } from './useGarageStore';

const TOKEN = 'test-jwt-token';

const PHOENIX: Vehicle = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: '11111111-1111-4111-8111-111111111111',
  name: 'Phoenix Trail Rig',
  make: 'Vanquish',
  model: 'VS4-10 Phoenix',
  scale: '1/10',
  vehicleClass: 'crawler_scale',
  isArchived: false,
  electronics: {},
  setupCount: 2,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

const KRATON: Vehicle = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: '11111111-1111-4111-8111-111111111111',
  name: 'Bash Beater',
  make: 'Arrma',
  model: 'Kraton',
  scale: '1/8',
  vehicleClass: 'monster_truck',
  isArchived: false,
  electronics: {},
  setupCount: 0,
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
}

describe('useGarageStore', () => {
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

  it('does not call the API when fetchVehicles runs without a session', async () => {
    await useGarageStore.getState().fetchVehicles();

    expect(fetch).not.toHaveBeenCalled();
    expect(useGarageStore.getState().vehicles).toEqual([]);
    expect(useGarageStore.getState().error).toMatch(/sign in/i);
  });

  it('fills the rack and defaults activeVehicleId to the first chassis', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope([PHOENIX, KRATON])));

    await useGarageStore.getState().fetchVehicles();

    const state = useGarageStore.getState();
    expect(state.vehicles).toEqual([PHOENIX, KRATON]);
    expect(state.activeVehicleId).toBe(PHOENIX.id);
    expect(state.hasLoaded).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/garage/vehicles',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      }),
    );
  });

  it('keeps an existing activeVehicleId when refetching the rack', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({ activeVehicleId: KRATON.id });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope([PHOENIX, KRATON])));

    await useGarageStore.getState().fetchVehicles();

    expect(useGarageStore.getState().activeVehicleId).toBe(KRATON.id);
  });

  it('appends a created chassis and makes it active', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({ vehicles: [PHOENIX], activeVehicleId: PHOENIX.id, hasLoaded: true });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(KRATON, 201), 201));

    const created = await useGarageStore.getState().createVehicle({
      name: KRATON.name,
      make: KRATON.make,
      model: KRATON.model,
      scale: KRATON.scale,
      vehicleClass: KRATON.vehicleClass,
    });

    expect(created).toEqual(KRATON);
    expect(useGarageStore.getState().vehicles).toEqual([PHOENIX, KRATON]);
    expect(useGarageStore.getState().activeVehicleId).toBe(KRATON.id);
    expect(fetch).toHaveBeenCalledWith(
      '/api/garage/vehicles',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      }),
    );
  });

  it('patches make and model in place without dropping the rest of the rack', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [PHOENIX, KRATON],
      activeVehicleId: PHOENIX.id,
      hasLoaded: true,
    });
    const patched: Vehicle = {
      ...PHOENIX,
      name: 'Rubicon Spec Phoenix',
      make: 'Vanquish',
      model: 'VS4-10 Phoenix Ultra',
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(patched)));

    await useGarageStore.getState().updateVehicle(PHOENIX.id, {
      name: patched.name,
      model: patched.model,
    });

    expect(useGarageStore.getState().vehicles).toEqual([patched, KRATON]);
    expect(useGarageStore.getState().activeVehicleId).toBe(PHOENIX.id);
  });

  it('removes a deleted chassis and selects another remaining bay when it was active', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [PHOENIX, KRATON],
      activeVehicleId: PHOENIX.id,
      hasLoaded: true,
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(envelope({ deleted: true, id: PHOENIX.id })),
    );

    await useGarageStore.getState().deleteVehicle(PHOENIX.id);

    expect(useGarageStore.getState().vehicles).toEqual([KRATON]);
    expect(useGarageStore.getState().activeVehicleId).toBe(KRATON.id);
  });

  it('keeps the active bay when a different chassis is deleted', async () => {
    useAuthStore.setState({ token: TOKEN, isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [PHOENIX, KRATON],
      activeVehicleId: PHOENIX.id,
      hasLoaded: true,
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(envelope({ deleted: true, id: KRATON.id })),
    );

    await useGarageStore.getState().deleteVehicle(KRATON.id);

    expect(useGarageStore.getState().vehicles).toEqual([PHOENIX]);
    expect(useGarageStore.getState().activeVehicleId).toBe(PHOENIX.id);
  });
});
