import { create } from 'zustand';
import {
  apiDeleteAdminSetup,
  apiGetAdminAuditLog,
  apiGetAdminOverview,
  apiGetAdminReports,
  apiGetAdminSetups,
  apiGetAdminUsers,
  apiModerateSetupVisibility,
  apiModerateUserRole,
  apiModerateUserSuspension,
  apiResolveAdminReport,
  type AdminOverview,
  type AdminReportQueryOptions,
  type AdminReportStatus,
  type AdminReportSummary,
  type AdminSetupQueryOptions,
  type AdminSetupSummary,
  type AdminUserQueryOptions,
  type AdminUserSummary,
  type ModerationAuditLogEntry,
  type UserRole,
} from '../api/admin';
import { ApiError } from '../api/http';
import { useAuthStore } from './useAuthStore';

export interface AdminFilters {
  userQuery: string;
  userRole?: UserRole;
  userSuspended?: boolean;
  setupQuery: string;
  setupHidden?: boolean;
  setupPublic?: boolean;
  reportStatus: AdminReportStatus;
}

export interface AdminStoreState {
  overview: AdminOverview | null;
  users: AdminUserSummary[];
  usersCursor: string | null;
  usersHasMore: boolean;
  setups: AdminSetupSummary[];
  setupsCursor: string | null;
  setupsHasMore: boolean;
  auditLogs: ModerationAuditLogEntry[];
  auditLogsCursor: string | null;
  auditLogsHasMore: boolean;
  reports: AdminReportSummary[];
  reportsCursor: string | null;
  reportsHasMore: boolean;

  filters: AdminFilters;
  isLoading: boolean;
  isActionLoading: boolean;
  error: string | null;
  actionError: string | null;

  setFilters: (filters: Partial<AdminFilters>) => void;
  fetchOverview: () => Promise<void>;
  fetchUsers: (reset?: boolean) => Promise<void>;
  fetchSetups: (reset?: boolean) => Promise<void>;
  fetchAuditLog: (reset?: boolean) => Promise<void>;
  fetchReports: (reset?: boolean) => Promise<void>;
  resolveReport: (
    reportId: string,
    payload: {
      status: 'actioned' | 'dismissed';
      reason: string;
      hideSetup?: boolean;
      hideComment?: boolean;
      suspendUser?: boolean;
    },
  ) => Promise<AdminReportSummary>;
  suspendUser: (
    userId: string,
    suspend: boolean,
    reason?: string,
  ) => Promise<AdminUserSummary>;
  changeUserRole: (
    userId: string,
    role: UserRole,
    reason?: string,
  ) => Promise<AdminUserSummary>;
  toggleSetupVisibility: (
    setupId: string,
    hide: boolean,
    reason?: string,
  ) => Promise<AdminSetupSummary>;
  deleteSetup: (
    setupId: string,
    reason: string,
  ) => Promise<{ deleted: true; id: string }>;
  reset: () => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.messages.join(' ') || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Admin operation failed';
}

function getTokenOrThrow(): string {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('Authentication required');
  }
  return token;
}

const DEFAULT_FILTERS: AdminFilters = {
  userQuery: '',
  userRole: undefined,
  userSuspended: undefined,
  setupQuery: '',
  setupHidden: undefined,
  setupPublic: undefined,
  reportStatus: 'open',
};

export const useAdminStore = create<AdminStoreState>((set, get) => ({
  overview: null,
  users: [],
  usersCursor: null,
  usersHasMore: false,
  setups: [],
  setupsCursor: null,
  setupsHasMore: false,
  auditLogs: [],
  auditLogsCursor: null,
  auditLogsHasMore: false,
  reports: [],
  reportsCursor: null,
  reportsHasMore: false,

  filters: { ...DEFAULT_FILTERS },
  isLoading: false,
  isActionLoading: false,
  error: null,
  actionError: null,

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  fetchOverview: async () => {
    const token = getTokenOrThrow();
    set({ isLoading: true, error: null });
    try {
      const overview = await apiGetAdminOverview(token);
      set({ overview, isLoading: false });
    } catch (err) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  fetchUsers: async (reset = false) => {
    const token = getTokenOrThrow();
    const { filters, usersCursor, users, isLoading } = get();
    if (!reset && isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const options: AdminUserQueryOptions = {
        limit: 20,
        cursor: reset ? undefined : usersCursor ?? undefined,
        q: filters.userQuery.trim() || undefined,
        role: filters.userRole,
        suspended: filters.userSuspended,
      };

      const res = await apiGetAdminUsers(options, token);
      set({
        users: reset ? res.items : [...users, ...res.items],
        usersCursor: res.nextCursor,
        usersHasMore: res.hasMore,
        isLoading: false,
      });
    } catch (err) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  fetchSetups: async (reset = false) => {
    const token = getTokenOrThrow();
    const { filters, setupsCursor, setups, isLoading } = get();
    if (!reset && isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const options: AdminSetupQueryOptions = {
        limit: 20,
        cursor: reset ? undefined : setupsCursor ?? undefined,
        q: filters.setupQuery.trim() || undefined,
        hidden: filters.setupHidden,
        isPublic: filters.setupPublic,
      };

      const res = await apiGetAdminSetups(options, token);
      set({
        setups: reset ? res.items : [...setups, ...res.items],
        setupsCursor: res.nextCursor,
        setupsHasMore: res.hasMore,
        isLoading: false,
      });
    } catch (err) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  fetchAuditLog: async (reset = false) => {
    const token = getTokenOrThrow();
    const { auditLogsCursor, auditLogs, isLoading } = get();
    if (!reset && isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const res = await apiGetAdminAuditLog(
        {
          limit: 30,
          cursor: reset ? undefined : auditLogsCursor ?? undefined,
        },
        token,
      );
      set({
        auditLogs: reset ? res.items : [...auditLogs, ...res.items],
        auditLogsCursor: res.nextCursor,
        auditLogsHasMore: res.hasMore,
        isLoading: false,
      });
    } catch (err) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  fetchReports: async (reset = false) => {
    const token = getTokenOrThrow();
    const { filters, reportsCursor, reports, isLoading } = get();
    if (!reset && isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const options: AdminReportQueryOptions = {
        limit: 20,
        cursor: reset ? undefined : reportsCursor ?? undefined,
        status: filters.reportStatus,
      };
      const res = await apiGetAdminReports(options, token);
      set({
        reports: reset ? res.items : [...reports, ...res.items],
        reportsCursor: res.nextCursor,
        reportsHasMore: res.hasMore,
        isLoading: false,
      });
    } catch (err) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  resolveReport: async (reportId, payload) => {
    const token = getTokenOrThrow();
    set({ isActionLoading: true, actionError: null });
    try {
      const updated = await apiResolveAdminReport(reportId, payload, token);
      set((state) => ({
        reports: state.reports.map((report) =>
          report.id === reportId ? updated : report,
        ),
        isActionLoading: false,
      }));
      void get().fetchOverview();
      void get().fetchAuditLog(true);
      return updated;
    } catch (err) {
      const msg = errorMessage(err);
      set({ actionError: msg, isActionLoading: false });
      throw err;
    }
  },

  suspendUser: async (userId, suspend, reason) => {
    const token = getTokenOrThrow();
    set({ isActionLoading: true, actionError: null });
    try {
      const updated = await apiModerateUserSuspension(
        userId,
        { suspend, reason },
        token,
      );
      set((state) => ({
        users: state.users.map((u) => (u.id === userId ? updated : u)),
        isActionLoading: false,
      }));
      // Refresh overview and audit logs in background
      void get().fetchOverview();
      void get().fetchAuditLog(true);
      return updated;
    } catch (err) {
      const msg = errorMessage(err);
      set({ actionError: msg, isActionLoading: false });
      throw err;
    }
  },

  changeUserRole: async (userId, role, reason) => {
    const token = getTokenOrThrow();
    set({ isActionLoading: true, actionError: null });
    try {
      const updated = await apiModerateUserRole(
        userId,
        { role, reason },
        token,
      );
      set((state) => ({
        users: state.users.map((u) => (u.id === userId ? updated : u)),
        isActionLoading: false,
      }));
      void get().fetchOverview();
      void get().fetchAuditLog(true);
      return updated;
    } catch (err) {
      const msg = errorMessage(err);
      set({ actionError: msg, isActionLoading: false });
      throw err;
    }
  },

  toggleSetupVisibility: async (setupId, hide, reason) => {
    const token = getTokenOrThrow();
    set({ isActionLoading: true, actionError: null });
    try {
      const updated = await apiModerateSetupVisibility(
        setupId,
        { hide, reason },
        token,
      );
      set((state) => ({
        setups: state.setups.map((s) => (s.id === setupId ? updated : s)),
        isActionLoading: false,
      }));
      void get().fetchOverview();
      void get().fetchAuditLog(true);
      return updated;
    } catch (err) {
      const msg = errorMessage(err);
      set({ actionError: msg, isActionLoading: false });
      throw err;
    }
  },

  deleteSetup: async (setupId, reason) => {
    const token = getTokenOrThrow();
    set({ isActionLoading: true, actionError: null });
    try {
      const res = await apiDeleteAdminSetup(setupId, { reason }, token);
      set((state) => ({
        setups: state.setups.filter((s) => s.id !== setupId),
        isActionLoading: false,
      }));
      void get().fetchOverview();
      void get().fetchAuditLog(true);
      return res;
    } catch (err) {
      const msg = errorMessage(err);
      set({ actionError: msg, isActionLoading: false });
      throw err;
    }
  },

  reset: () => {
    set({
      overview: null,
      users: [],
      usersCursor: null,
      usersHasMore: false,
      setups: [],
      setupsCursor: null,
      setupsHasMore: false,
      auditLogs: [],
      auditLogsCursor: null,
      auditLogsHasMore: false,
      reports: [],
      reportsCursor: null,
      reportsHasMore: false,
      filters: { ...DEFAULT_FILTERS },
      isLoading: false,
      isActionLoading: false,
      error: null,
      actionError: null,
    });
  },
}));
