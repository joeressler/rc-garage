# Milestone 10: Frontend Garage Fleet Management & `useGarageStore`

## 1. Objective
Implement the garage fleet interface and `useGarageStore`, enabling drivers to view their vehicles in a chassis rack grid, add new chassis, modify specifications, and switch the active vehicle.

---

## 2. Scope & Target Files
- `/frontend/src/stores/useGarageStore.ts`
- `/frontend/src/views/GarageFleetView.tsx`
- `/frontend/src/components/garage/ChassisRackGrid.tsx`
- `/frontend/src/components/garage/ChassisBayCard.tsx`
- `/frontend/src/components/garage/AddChassisModal.tsx`
- `/frontend/src/components/garage/EditChassisModal.tsx`

---

## 3. Detailed Technical Requirements

### 3.1 Zustand Garage Store (`frontend/src/stores/useGarageStore.ts`)
```typescript
import { create } from 'zustand';

export interface Vehicle {
  id: string;
  userId: string;
  name: string;
  make: string;
  model: string;
  scale: string;
  vehicleClass: string;
  setupCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GarageState {
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  isLoading: boolean;
  error: string | null;

  getActiveVehicle: () => Vehicle | undefined;
  fetchVehicles: () => Promise<void>;
  selectVehicle: (vehicleId: string) => void;
  createVehicle: (payload: { name: string; make: string; model: string; scale: string; vehicleClass: string }) => Promise<Vehicle>;
  updateVehicle: (vehicleId: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (vehicleId: string) => Promise<void>;
}

export const useGarageStore = create<GarageState>((set, get) => ({
  vehicles: [],
  activeVehicleId: null,
  isLoading: false,
  error: null,

  getActiveVehicle: () => get().vehicles.find((v) => v.id === get().activeVehicleId),
  fetchVehicles: async () => {
    set({ isLoading: true, error: null });
    try {
      const vehicles = await apiGetVehicles();
      set({
        vehicles,
        isLoading: false,
        activeVehicleId: get().activeVehicleId || (vehicles[0]?.id ?? null),
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  selectVehicle: (vehicleId) => set({ activeVehicleId: vehicleId }),
  createVehicle: async (payload) => {
    const newVehicle = await apiCreateVehicle(payload);
    set((state) => ({ vehicles: [...state.vehicles, newVehicle], activeVehicleId: newVehicle.id }));
    return newVehicle;
  },
  updateVehicle: async (id, updates) => {
    const updated = await apiUpdateVehicle(id, updates);
    set((state) => ({
      vehicles: state.vehicles.map((v) => (v.id === id ? updated : v)),
    }));
  },
  deleteVehicle: async (id) => {
    await apiDeleteVehicle(id);
    set((state) => ({
      vehicles: state.vehicles.filter((v) => v.id !== id),
      activeVehicleId: state.activeVehicleId === id ? state.vehicles[0]?.id ?? null : state.activeVehicleId,
    }));
  },
}));
```

### 3.2 Visual UI Components
1. **`GarageFleetView`:** Displays the chassis rack header, vehicle count badge, and "Add New Chassis" CTA button.
2. **`ChassisRackGrid`:** Responsive CSS grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`) rendering chassis bays.
3. **`ChassisBayCard`:**
   - Card container with corner rivet accents (`border border-pit-rubber bg-pit-steel`).
   - Tread pattern edge border.
   - Stencil class badge (e.g. `SCALE CRAWLER 1/10` in `font-display`).
   - Setup sheet count readout with wrench icon.
   - Quick action buttons: "Select for Workbench", "Edit Chassis", "Delete".
4. **`AddChassisModal`:** Modal styled with knurled aluminum border and hazard orange submit button, validating inputs using Zod.

---

## 4. Verification & Acceptance Criteria
1. Drivers can create a new vehicle; it immediately appears in the grid and becomes active.
2. Editing a vehicle's make/model updates the display reactively without a full page reload.
3. Deleting a vehicle prompts confirmation and updates the active selection smoothly.
4. Empty garage state displays an industrial onboarding prompt to register the first vehicle.
