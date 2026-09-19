import { create } from 'zustand';
import { apiGetFeed, apiToggleLike, type FeedItem, type FeedSortBy } from '../api/feed';
import { apiForkSetup, type ForkSetupPayload } from '../api/fork';
import { ApiError } from '../api/http';
import {
  apiCreateSetup,
  apiGetSetup,
  apiListSetups,
  apiUpdateSetup,
  calculateCogBias,
  calculateFdr,
  CreateSetupSchema,
  defaultSetupSettings,
  prepareSettingsForSave,
  TRANSMISSION_INTERNAL_RATIO_MAX,
  TRANSMISSION_INTERNAL_RATIO_MIN,
  type AxleTireSpecification,
  type CreateSetupDto,
  type SetupEntity,
  type SetupSettings,
  type ShockSpecification,
  type SurfaceType,
  type TrackConditions,
  type UpdateSetupDto,
} from '../api/setups';
import type { VehicleClass } from '../api/vehicles';
import { useAuthStore } from './useAuthStore';
import { useGarageStore } from './useGarageStore';

export interface SetupSheetMeta {
  title: string;
  description: string;
  isPublic: boolean;
  tags: string[];
}

export interface FeedFilters {
  vehicleModel?: string;
  vehicleClass?: VehicleClass;
  surfaceType?: SurfaceType;
  locationTag?: string;
  tag?: string;
  sortBy: FeedSortBy;
  cursor?: string;
  limit: number;
}

export interface SetupState {
  // Current Editor / Active Sheet State
  activeSetup: SetupEntity | null;
  activeSettings: SetupSettings;
  meta: SetupSheetMeta;
  targetVehicleId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  validationErrors: Record<string, string>;

  // Comparison cache for diff viewing
  comparisonParentSetup: SetupSettings | null;

  // Community Feed State
  feedSetups: FeedItem[];
  feedFilters: FeedFilters;
  feedHasMore: boolean;
  feedNextCursor: string | null;
  isFeedLoading: boolean;
  feedError: string | null;

  // Live Math Computation Actions (Zero-latency pit-mat feedback)
  updateGearing: (pinion: number, spur: number, internalRatio: number) => void;
  updateWeights: (frontWeight: number, rearWeight: number) => void;
  updateSuspensionCorner: (
    axle: 'front' | 'rear',
    spec: Partial<ShockSpecification>,
  ) => void;
  updateTires: (
    axle: 'front' | 'rear',
    spec: Partial<AxleTireSpecification>,
  ) => void;
  updateTrackConditions: (conditions: Partial<TrackConditions>) => void;
  updateDriverNotes: (notes: string) => void;
  updateMeta: (updates: Partial<SetupSheetMeta>) => void;
  setTargetVehicleId: (vehicleId: string | null) => void;

  // Lifecycle & Persistence
  initNewSetup: (vehicleId?: string, defaultTitle?: string) => void;
  activateChassis: (vehicleId: string) => Promise<SetupEntity | null>;
  loadSetupById: (setupId: string) => Promise<void>;
  saveCurrentSetup: () => Promise<SetupEntity>;
  forkSetupIntoGarage: (
    sourceSetupId: string,
    targetVehicleId: string,
    title?: string,
    description?: string,
  ) => Promise<SetupEntity>;
  loadParentForComparison: (parentSetupId: string) => Promise<void>;
  clearErrors: () => void;
  reset: () => void;

  // Feed Actions
  fetchFeed: (reset?: boolean) => Promise<void>;
  setFeedFilters: (filters: Partial<FeedFilters>) => void;
  toggleLike: (setupId: string) => Promise<void>;
}

function requireToken(): string {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('Sign in to save telemetry sheets.');
  }
  return token;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.messages.join(' ') || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unable to persist setup sheet';
}

const initialMeta: SetupSheetMeta = {
  title: 'Chassis Telemetry Spec',
  description: '',
  isPublic: true,
  tags: [],
};

const initialFeedFilters: FeedFilters = {
  sortBy: 'newest',
  limit: 20,
};

// Drop in-flight sheet loads when the driver swaps chassis or starts a draft.
let editorEpoch = 0;

function resolveChassis(vehicleId?: string | null) {
  const garage = useGarageStore.getState();
  return garage.vehicles.find((vehicle) => vehicle.id === vehicleId) ?? garage.getActiveVehicle();
}

function draftTitleForChassis(vehicleId?: string | null, defaultTitle?: string): string {
  if (defaultTitle) {
    return defaultTitle;
  }
  const chassis = resolveChassis(vehicleId);
  return chassis ? `${chassis.make} ${chassis.model} Spec` : 'Chassis Telemetry Spec';
}

/**
 * Purpose: manage live telemetry sheet state with instant FDR/CoG calculations, community feed, and fork actions.
 */
export const useSetupStore = create<SetupState>((set, get) => ({
  activeSetup: null,
  activeSettings: defaultSetupSettings(),
  meta: { ...initialMeta },
  targetVehicleId: null,
  isDirty: false,
  isSaving: false,
  isLoading: false,
  error: null,
  validationErrors: {},
  comparisonParentSetup: null,

  // Community Feed Initial State
  feedSetups: [],
  feedFilters: { ...initialFeedFilters },
  feedHasMore: false,
  feedNextCursor: null,
  isFeedLoading: false,
  feedError: null,

  updateGearing: (pinion: number, spur: number, internalRatio: number) => {
    const { activeSettings, validationErrors } = get();
    const portalGearsInstalled = activeSettings.suspension.portalGearsInstalled;
    const portalBoxRatio = activeSettings.suspension.portalBoxRatio;

    const fdr = calculateFdr({
      pinionTeeth: pinion,
      spurTeeth: spur,
      transmissionInternalRatio: internalRatio,
      portalGearsInstalled,
      portalBoxRatio,
    });

    const nextErrors = { ...validationErrors };
    if (spur <= pinion) {
      nextErrors['settings.drivetrain.spurTeeth'] =
        'Spur gear teeth must exceed pinion gear teeth';
    } else {
      delete nextErrors['settings.drivetrain.spurTeeth'];
      delete nextErrors['settings.drivetrain.pinionTeeth'];
    }

    if (
      internalRatio < TRANSMISSION_INTERNAL_RATIO_MIN ||
      internalRatio > TRANSMISSION_INTERNAL_RATIO_MAX
    ) {
      nextErrors['settings.drivetrain.transmissionInternalRatio'] =
        `Internal ratio must be between ${TRANSMISSION_INTERNAL_RATIO_MIN.toFixed(1)} and ${TRANSMISSION_INTERNAL_RATIO_MAX.toFixed(1)}`;
    } else {
      delete nextErrors['settings.drivetrain.transmissionInternalRatio'];
    }

    set({
      isDirty: true,
      validationErrors: nextErrors,
      activeSettings: {
        ...activeSettings,
        drivetrain: {
          ...activeSettings.drivetrain,
          pinionTeeth: pinion,
          spurTeeth: spur,
          transmissionInternalRatio: internalRatio,
          calculatedFdr: fdr,
        },
      },
    });
  },

  updateWeights: (frontWeight: number, rearWeight: number) => {
    const { activeSettings, validationErrors } = get();
    const total = frontWeight + rearWeight;
    const bias = calculateCogBias(frontWeight, total);

    const nextErrors = { ...validationErrors };
    if (total < 200 || total > 25000) {
      nextErrors['settings.tiresAndWeight.weight.totalRtrWeightGrams'] =
        'RTR weight must be between 200g and 25000g';
    } else {
      delete nextErrors['settings.tiresAndWeight.weight.totalRtrWeightGrams'];
    }

    set({
      isDirty: true,
      validationErrors: nextErrors,
      activeSettings: {
        ...activeSettings,
        tiresAndWeight: {
          ...activeSettings.tiresAndWeight,
          weight: {
            ...activeSettings.tiresAndWeight.weight,
            frontAxleWeightGrams: frontWeight,
            rearAxleWeightGrams: rearWeight,
            totalRtrWeightGrams: total,
            frontWeightBiasPercentage: bias.frontBiasPercentage,
            rearWeightBiasPercentage: bias.rearBiasPercentage,
          },
        },
      },
    });
  },

  updateSuspensionCorner: (
    axle: 'front' | 'rear',
    spec: Partial<ShockSpecification>,
  ) => {
    const { activeSettings, validationErrors } = get();
    const nextErrors = { ...validationErrors };

    if (
      spec.oilViscosityValue !== undefined &&
      (spec.oilViscosityValue < 10 || spec.oilViscosityValue > 5000)
    ) {
      nextErrors[`settings.suspension.${axle}.oilViscosityValue`] =
        'Viscosity must be between 10 and 5000';
    } else if (spec.oilViscosityValue !== undefined) {
      delete nextErrors[`settings.suspension.${axle}.oilViscosityValue`];
    }

    if (
      spec.camberAngleDeg !== undefined &&
      (spec.camberAngleDeg < -8.0 || spec.camberAngleDeg > 8.0)
    ) {
      nextErrors[`settings.suspension.${axle}.camberAngleDeg`] =
        'Camber must be between -8.0° and +8.0°';
    } else if (spec.camberAngleDeg !== undefined) {
      delete nextErrors[`settings.suspension.${axle}.camberAngleDeg`];
    }

    if (
      spec.toeAngleDeg !== undefined &&
      (spec.toeAngleDeg < -8.0 || spec.toeAngleDeg > 8.0)
    ) {
      nextErrors[`settings.suspension.${axle}.toeAngleDeg`] =
        'Toe must be between -8.0° and +8.0°';
    } else if (spec.toeAngleDeg !== undefined) {
      delete nextErrors[`settings.suspension.${axle}.toeAngleDeg`];
    }

    if (spec.springRateDescription !== undefined) {
      const springs = spec.springRateDescription.trim();
      if (springs.length < 1) {
        nextErrors[`settings.suspension.${axle}.springRateDescription`] =
          'Spring rate is required';
      } else if (spec.springRateDescription.length > 50) {
        nextErrors[`settings.suspension.${axle}.springRateDescription`] =
          'Spring rate must be 50 characters or fewer';
      } else {
        delete nextErrors[`settings.suspension.${axle}.springRateDescription`];
      }
    }

    if (spec.rideHeightMm !== undefined) {
      if (spec.rideHeightMm < 0 || spec.rideHeightMm > 120) {
        nextErrors[`settings.suspension.${axle}.rideHeightMm`] =
          'Ride height must be between 0 and 120mm';
      } else {
        delete nextErrors[`settings.suspension.${axle}.rideHeightMm`];
      }
    }

    set({
      isDirty: true,
      validationErrors: nextErrors,
      activeSettings: {
        ...activeSettings,
        suspension: {
          ...activeSettings.suspension,
          [axle]: {
            ...activeSettings.suspension[axle],
            ...spec,
          },
        },
      },
    });
  },

  updateTires: (
    axle: 'front' | 'rear',
    spec: Partial<AxleTireSpecification>,
  ) => {
    const { activeSettings, validationErrors } = get();
    const nextErrors = { ...validationErrors };
    if (spec.compound !== undefined) {
      if (spec.compound.trim().length < 1) {
        nextErrors[`settings.tiresAndWeight.${axle}.compound`] =
          'Tire compound is required';
      } else if (spec.compound.length > 50) {
        nextErrors[`settings.tiresAndWeight.${axle}.compound`] =
          'Tire compound must be 50 characters or fewer';
      } else {
        delete nextErrors[`settings.tiresAndWeight.${axle}.compound`];
      }
    }

    set({
      isDirty: true,
      validationErrors: nextErrors,
      activeSettings: {
        ...activeSettings,
        tiresAndWeight: {
          ...activeSettings.tiresAndWeight,
          [axle]: {
            ...activeSettings.tiresAndWeight[axle],
            ...spec,
          },
        },
      },
    });
  },

  updateTrackConditions: (conditions: Partial<TrackConditions>) => {
    const { activeSettings } = get();
    set({
      isDirty: true,
      activeSettings: {
        ...activeSettings,
        trackConditions: {
          ...activeSettings.trackConditions,
          ...conditions,
        },
      },
    });
  },

  updateDriverNotes: (notes: string) => {
    const { activeSettings } = get();
    set({
      isDirty: true,
      activeSettings: {
        ...activeSettings,
        driverNotes: notes,
      },
    });
  },

  updateMeta: (updates: Partial<SetupSheetMeta>) => {
    const { meta, validationErrors } = get();
    const nextMeta = { ...meta, ...updates };
    const nextErrors = { ...validationErrors };
    if (nextMeta.title.trim().length >= 3) {
      delete nextErrors.title;
    }
    set({
      isDirty: true,
      meta: nextMeta,
      validationErrors: nextErrors,
    });
  },

  setTargetVehicleId: (vehicleId: string | null) => {
    set({ targetVehicleId: vehicleId });
  },

  initNewSetup: (vehicleId?: string, defaultTitle?: string) => {
    editorEpoch += 1;
    const resolvedVehicleId = vehicleId ?? resolveChassis(vehicleId)?.id ?? null;

    set({
      activeSetup: null,
      activeSettings: defaultSetupSettings(),
      meta: {
        title: draftTitleForChassis(resolvedVehicleId, defaultTitle),
        description: '',
        isPublic: true,
        tags: [],
      },
      targetVehicleId: resolvedVehicleId,
      isDirty: false,
      isSaving: false,
      isLoading: false,
      error: null,
      validationErrors: {},
      comparisonParentSetup: null,
    });
  },

  activateChassis: async (vehicleId: string): Promise<SetupEntity | null> => {
    const current = get();
    if (
      current.targetVehicleId === vehicleId &&
      (current.activeSetup === null || current.activeSetup.vehicleId === vehicleId)
    ) {
      return current.activeSetup;
    }

    // Detach immediately so edits/saves cannot rewrite the previous chassis spec.
    get().initNewSetup(vehicleId);
    const epoch = editorEpoch;
    const token = useAuthStore.getState().token;
    if (!token) {
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const sheets = await apiListSetups(token, vehicleId);
      if (epoch !== editorEpoch) {
        return get().activeSetup;
      }

      const latest = sheets[0];
      if (!latest) {
        set({ isLoading: false });
        return null;
      }

      await get().loadSetupById(latest.id);
      const loaded = get().activeSetup;
      return loaded?.vehicleId === vehicleId ? loaded : null;
    } catch (err: unknown) {
      if (epoch === editorEpoch) {
        set({ isLoading: false, error: errorMessage(err) });
      }
      return null;
    }
  },

  loadSetupById: async (setupId: string) => {
    const epoch = ++editorEpoch;
    set({ isLoading: true, error: null, validationErrors: {} });
    try {
      const token = useAuthStore.getState().token;
      const setup = await apiGetSetup(setupId, token);
      if (epoch !== editorEpoch) {
        return;
      }
      set({
        activeSetup: setup,
        activeSettings: setup.settings,
        meta: {
          title: setup.title,
          description: setup.description ?? '',
          isPublic: setup.isPublic,
          tags: setup.tags,
        },
        targetVehicleId: setup.vehicleId,
        isDirty: false,
        isLoading: false,
      });

      if (setup.forkedFromSetupId) {
        void get().loadParentForComparison(setup.forkedFromSetupId);
      }
    } catch (err: unknown) {
      if (epoch !== editorEpoch) {
        return;
      }
      set({
        error: errorMessage(err),
        isLoading: false,
      });
    }
  },

  saveCurrentSetup: async (): Promise<SetupEntity> => {
    const state = get();
    const { activeSetup, activeSettings, meta, targetVehicleId } = state;
    const token = requireToken();

    const vehicleId = targetVehicleId ?? activeSetup?.vehicleId;
    if (!vehicleId) {
      const err = { vehicleId: 'Select a vehicle from your garage rack first.' };
      set({ validationErrors: err, error: 'Select a vehicle to assign this setup sheet.' });
      throw new Error('Vehicle is required');
    }

    const payload: CreateSetupDto = {
      vehicleId,
      title: meta.title.trim(),
      description: meta.description.trim() ? meta.description.trim() : undefined,
      isPublic: meta.isPublic,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      settings: prepareSettingsForSave(activeSettings),
    };

    // Client-side Zod validation before submitting
    const parsed = CreateSetupSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = issue.message;
        }
      }
      set({ validationErrors: errors, error: 'Fix highlighted telemetry inputs before saving.' });
      throw new Error('Validation failed');
    }

    set({ isSaving: true, error: null, validationErrors: {} });
    try {
      let saved: SetupEntity;
      const canUpdateExisting = !!activeSetup?.id && activeSetup.vehicleId === vehicleId;
      if (canUpdateExisting && activeSetup) {
        const updatePayload: UpdateSetupDto = {
          title: parsed.data.title,
          description: parsed.data.description,
          isPublic: parsed.data.isPublic,
          tags: parsed.data.tags,
          settings: parsed.data.settings,
        };
        saved = await apiUpdateSetup(token, activeSetup.id, updatePayload);
      } else {
        saved = await apiCreateSetup(token, parsed.data);
      }

      set({
        activeSetup: saved,
        activeSettings: saved.settings,
        meta: {
          title: saved.title,
          description: saved.description ?? '',
          isPublic: saved.isPublic,
          tags: saved.tags,
        },
        targetVehicleId: saved.vehicleId,
        isDirty: false,
        isSaving: false,
        error: null,
        validationErrors: {},
      });

      // Refresh fleet setup counts in garage store
      void useGarageStore.getState().fetchVehicles();

      return saved;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 400) {
        const errors: Record<string, string> = {};
        for (const msg of err.messages) {
          const parts = msg.split(': ');
          if (parts.length > 1 && parts[0]) {
            errors[parts[0].trim()] = parts.slice(1).join(': ').trim();
          } else {
            errors['general'] = msg;
          }
        }
        set({ validationErrors: errors, error: errorMessage(err), isSaving: false });
      } else {
        set({ error: errorMessage(err), isSaving: false });
      }
      throw err;
    }
  },

  forkSetupIntoGarage: async (
    sourceSetupId: string,
    targetVehicleId: string,
    title?: string,
    description?: string,
  ): Promise<SetupEntity> => {
    const token = requireToken();
    const payload: ForkSetupPayload = {
      targetVehicleId,
      title: title?.trim() || undefined,
      description: description?.trim() || undefined,
    };

    set({ isSaving: true, error: null });
    try {
      const forked = await apiForkSetup(sourceSetupId, payload, token);
      set({
        activeSetup: forked,
        activeSettings: forked.settings,
        meta: {
          title: forked.title,
          description: forked.description ?? '',
          isPublic: forked.isPublic,
          tags: forked.tags,
        },
        targetVehicleId: forked.vehicleId,
        isDirty: false,
        isSaving: false,
        error: null,
      });

      if (forked.forkedFromSetupId) {
        void get().loadParentForComparison(forked.forkedFromSetupId);
      }

      // Refresh fleet setup counts in garage store
      void useGarageStore.getState().fetchVehicles();

      return forked;
    } catch (err: unknown) {
      set({ error: errorMessage(err), isSaving: false });
      throw err;
    }
  },

  loadParentForComparison: async (parentSetupId: string) => {
    try {
      const token = useAuthStore.getState().token;
      const parent = await apiGetSetup(parentSetupId, token);
      set({ comparisonParentSetup: parent.settings });
    } catch {
      // Comparison is non-critical diagnostic enhancement
    }
  },

  clearErrors: () => set({ error: null, validationErrors: {} }),

  reset: () => {
    editorEpoch += 1;
    set({
      activeSetup: null,
      activeSettings: defaultSetupSettings(),
      meta: { ...initialMeta },
      targetVehicleId: null,
      isDirty: false,
      isSaving: false,
      isLoading: false,
      error: null,
      validationErrors: {},
      comparisonParentSetup: null,
      feedSetups: [],
      feedFilters: { ...initialFeedFilters },
      feedHasMore: false,
      feedNextCursor: null,
      isFeedLoading: false,
      feedError: null,
    });
  },

  // Community Feed Actions
  fetchFeed: async (reset = false) => {
    const { feedFilters, feedNextCursor, feedSetups } = get();
    const token = useAuthStore.getState().token;

    set({ isFeedLoading: true, feedError: null });

    try {
      const cursor = reset ? undefined : feedNextCursor ?? undefined;
      const response = await apiGetFeed(
        {
          cursor,
          limit: feedFilters.limit,
          model: feedFilters.vehicleModel,
          vehicleClass: feedFilters.vehicleClass,
          surfaceType: feedFilters.surfaceType,
          locationTag: feedFilters.locationTag,
          tag: feedFilters.tag,
          sortBy: feedFilters.sortBy,
        },
        token,
      );

      set({
        feedSetups: reset ? response.items : [...feedSetups, ...response.items],
        feedNextCursor: response.nextCursor,
        feedHasMore: response.hasMore,
        isFeedLoading: false,
      });
    } catch (err: unknown) {
      set({
        feedError: errorMessage(err),
        isFeedLoading: false,
      });
    }
  },

  setFeedFilters: (filters: Partial<FeedFilters>) => {
    const { feedFilters } = get();
    set({
      feedFilters: {
        ...feedFilters,
        ...filters,
      },
    });
  },

  toggleLike: async (setupId: string) => {
    const token = requireToken();
    try {
      const result = await apiToggleLike(setupId, token);
      // Optimistically or synchronously update feedSetups
      set((state) => ({
        feedSetups: state.feedSetups.map((item) =>
          item.id === setupId
            ? {
                ...item,
                isLikedByCaller: result.liked,
                likeCount: result.likeCount,
              }
            : item,
        ),
      }));
    } catch (err: unknown) {
      set({ feedError: errorMessage(err) });
      throw err;
    }
  },
}));
