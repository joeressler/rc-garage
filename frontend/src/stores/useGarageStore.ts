import { create } from 'zustand';
import { ApiError } from '../api/http';
import {
  apiCreateVehicle,
  apiDeleteVehicle,
  apiListVehicles,
  apiUpdateVehicle,
  type CreateVehicleDto,
  type UpdateVehicleDto,
  type Vehicle,
} from '../api/vehicles';
import { useAuthStore } from './useAuthStore';

export type { Vehicle };

export interface GarageState {
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;

  getActiveVehicle: () => Vehicle | undefined;
  fetchVehicles: () => Promise<void>;
  selectVehicle: (vehicleId: string) => void;
  createVehicle: (payload: CreateVehicleDto) => Promise<Vehicle>;
  updateVehicle: (vehicleId: string, updates: UpdateVehicleDto) => Promise<void>;
  deleteVehicle: (vehicleId: string) => Promise<void>;
  reset: () => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.messages.join(' ') || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unable to reach the garage API';
}

function requireToken(): string {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('Sign in to manage your chassis rack.');
  }
  return token;
}

const idleGarage = {
  vehicles: [] as Vehicle[],
  activeVehicleId: null as string | null,
  isLoading: false,
  hasLoaded: false,
  error: null as string | null,
};

/**
 * Purpose: hold the authenticated driver's fleet and the chassis currently on the workbench.
 */
export const useGarageStore = create<GarageState>((set, get) => ({
  ...idleGarage,

  getActiveVehicle: () => get().vehicles.find((vehicle) => vehicle.id === get().activeVehicleId),

  fetchVehicles: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ isLoading: false, error: 'Sign in to load your chassis rack.' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const vehicles = await apiListVehicles(token);
      set({
        vehicles,
        isLoading: false,
        hasLoaded: true,
        activeVehicleId: get().activeVehicleId || (vehicles[0]?.id ?? null),
      });
    } catch (err: unknown) {
      set({ error: errorMessage(err), isLoading: false, hasLoaded: true });
    }
  },

  selectVehicle: (vehicleId) => set({ activeVehicleId: vehicleId }),

  createVehicle: async (payload) => {
    try {
      const newVehicle = await apiCreateVehicle(requireToken(), payload);
      set((state) => ({
        vehicles: [...state.vehicles, newVehicle],
        activeVehicleId: newVehicle.id,
        error: null,
        hasLoaded: true,
      }));
      return newVehicle;
    } catch (err: unknown) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  updateVehicle: async (vehicleId, updates) => {
    try {
      const updated = await apiUpdateVehicle(requireToken(), vehicleId, updates);
      set((state) => ({
        vehicles: state.vehicles.map((vehicle) =>
          vehicle.id === vehicleId ? updated : vehicle,
        ),
        error: null,
      }));
    } catch (err: unknown) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  deleteVehicle: async (vehicleId) => {
    try {
      await apiDeleteVehicle(requireToken(), vehicleId);
      set((state) => {
        const vehicles = state.vehicles.filter((vehicle) => vehicle.id !== vehicleId);
        return {
          vehicles,
          activeVehicleId:
            state.activeVehicleId === vehicleId
              ? (vehicles[0]?.id ?? null)
              : state.activeVehicleId,
          error: null,
        };
      });
    } catch (err: unknown) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  reset: () => set({ ...idleGarage }),
}));
