import { apiJson } from './http';
import type { UserRole } from './auth';

export type { UserRole };

export interface AdminOverview {
  userCount: number;
  setupCount: number;
  publicSetupCount: number;
  hiddenSetupCount: number;
  suspendedUserCount: number;
  likes24h: number;
  openReportCount: number;
}

export interface AdminUserSummary {
  id: string;
  callsign: string;
  email: string;
  role: UserRole;
  isSuspended: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  avatarUrl: string | null;
  bio: string | null;
  vehicleCount: number;
  setupCount: number;
  createdAt: string;
}

export interface PaginatedAdminUsers {
  items: AdminUserSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AdminSetupSummary {
  id: string;
  title: string;
  vehicleId: string;
  userId: string;
  authorCallsign: string;
  authorEmail: string;
  vehicleName: string;
  vehicleMake: string;
  vehicleModel: string;
  isPublic: boolean;
  isHidden: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  forkCount: number;
  likeCount: number;
  qrSlug: string;
  surfaceType: string;
  calculatedFdr: number;
  frontBiasPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAdminSetups {
  items: AdminSetupSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ModerationAuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorCallsign: string;
  actorRole: UserRole;
  action: string;
  targetType: 'user' | 'setup' | 'comment';
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedAuditLog {
  items: ModerationAuditLogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type AdminReportStatus = 'open' | 'actioned' | 'dismissed';
export type AdminReportTargetType = 'setup' | 'user' | 'comment';

export interface AdminReportSummary {
  id: string;
  reporterUserId: string;
  reporterCallsign: string;
  targetType: AdminReportTargetType;
  targetId: string;
  targetLabel: string;
  reasonCode: string;
  details: string | null;
  status: AdminReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
}

export interface PaginatedAdminReports {
  items: AdminReportSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AdminReportQueryOptions {
  cursor?: string;
  limit?: number;
  status?: AdminReportStatus;
}

export interface AdminUserQueryOptions {
  cursor?: string;
  limit?: number;
  q?: string;
  role?: UserRole;
  suspended?: boolean;
}

export interface AdminSetupQueryOptions {
  cursor?: string;
  limit?: number;
  q?: string;
  hidden?: boolean;
  isPublic?: boolean;
  authorCallsign?: string;
}

export interface AdminAuditLogQueryOptions {
  cursor?: string;
  limit?: number;
}

export function apiGetAdminOverview(token: string): Promise<AdminOverview> {
  return apiJson<AdminOverview>('/api/garage/admin/overview', {
    method: 'GET',
    token,
  });
}

export function apiGetAdminUsers(
  options: AdminUserQueryOptions = {},
  token: string,
): Promise<PaginatedAdminUsers> {
  const query = new URLSearchParams();
  if (options.cursor) query.set('cursor', options.cursor);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.q) query.set('q', options.q);
  if (options.role) query.set('role', options.role);
  if (options.suspended !== undefined)
    query.set('suspended', String(options.suspended));

  const qs = query.toString();
  return apiJson<PaginatedAdminUsers>(
    `/api/garage/admin/users${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      token,
    },
  );
}

export function apiModerateUserSuspension(
  userId: string,
  payload: { suspend: boolean; reason?: string },
  token: string,
): Promise<AdminUserSummary> {
  return apiJson<AdminUserSummary>(
    `/api/garage/admin/users/${userId}/suspension`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
      token,
    },
  );
}

export function apiModerateUserRole(
  userId: string,
  payload: { role: UserRole; reason?: string },
  token: string,
): Promise<AdminUserSummary> {
  return apiJson<AdminUserSummary>(`/api/garage/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
  });
}

export function apiGetAdminSetups(
  options: AdminSetupQueryOptions = {},
  token: string,
): Promise<PaginatedAdminSetups> {
  const query = new URLSearchParams();
  if (options.cursor) query.set('cursor', options.cursor);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.q) query.set('q', options.q);
  if (options.hidden !== undefined)
    query.set('hidden', String(options.hidden));
  if (options.isPublic !== undefined)
    query.set('isPublic', String(options.isPublic));
  if (options.authorCallsign)
    query.set('authorCallsign', options.authorCallsign);

  const qs = query.toString();
  return apiJson<PaginatedAdminSetups>(
    `/api/garage/admin/setups${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      token,
    },
  );
}

export function apiModerateSetupVisibility(
  setupId: string,
  payload: { hide: boolean; reason?: string },
  token: string,
): Promise<AdminSetupSummary> {
  return apiJson<AdminSetupSummary>(
    `/api/garage/admin/setups/${setupId}/visibility`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
      token,
    },
  );
}

export function apiDeleteAdminSetup(
  setupId: string,
  payload: { reason: string },
  token: string,
): Promise<{ deleted: true; id: string }> {
  return apiJson<{ deleted: true; id: string }>(
    `/api/garage/admin/setups/${setupId}`,
    {
      method: 'DELETE',
      body: JSON.stringify(payload),
      token,
    },
  );
}

export function apiGetAdminAuditLog(
  options: AdminAuditLogQueryOptions = {},
  token: string,
): Promise<PaginatedAuditLog> {
  const query = new URLSearchParams();
  if (options.cursor) query.set('cursor', options.cursor);
  if (options.limit !== undefined) query.set('limit', String(options.limit));

  const qs = query.toString();
  return apiJson<PaginatedAuditLog>(
    `/api/garage/admin/audit-log${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      token,
    },
  );
}

export function apiGetAdminReports(
  options: AdminReportQueryOptions = {},
  token: string,
): Promise<PaginatedAdminReports> {
  const query = new URLSearchParams();
  if (options.cursor) query.set('cursor', options.cursor);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.status) query.set('status', options.status);

  const qs = query.toString();
  return apiJson<PaginatedAdminReports>(
    `/api/garage/admin/reports${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      token,
    },
  );
}

export function apiResolveAdminReport(
  reportId: string,
  payload: {
    status: 'actioned' | 'dismissed';
    reason: string;
    hideSetup?: boolean;
    hideComment?: boolean;
    suspendUser?: boolean;
  },
  token: string,
): Promise<AdminReportSummary> {
  return apiJson<AdminReportSummary>(`/api/garage/admin/reports/${reportId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  });
}
