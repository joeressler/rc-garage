import { apiJson } from './http';

export type NotificationType = 'like' | 'fork' | 'comment' | 'report_outcome';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
  actorCallsign: string | null;
  setupTitle: string | null;
  setupId: string | null;
  qrSlug: string | null;
  bodyPreview: string | null;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
}

export interface UnreadCountResult {
  unreadCount: number;
}

export function apiListNotifications(
  options: { cursor?: string; limit?: number; unreadOnly?: boolean } = {},
  token: string,
): Promise<PaginatedNotifications> {
  const query = new URLSearchParams();
  if (options.cursor) query.set('cursor', options.cursor);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.unreadOnly !== undefined) {
    query.set('unreadOnly', String(options.unreadOnly));
  }
  const qs = query.toString();
  return apiJson<PaginatedNotifications>(
    `/api/garage/notifications${qs ? `?${qs}` : ''}`,
    { method: 'GET', token },
  );
}

export function apiMarkNotificationsRead(
  body: { ids?: string[] } = {},
  token: string,
): Promise<UnreadCountResult> {
  return apiJson<UnreadCountResult>('/api/garage/notifications/read', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function apiGetUnreadCount(token: string): Promise<UnreadCountResult> {
  return apiJson<UnreadCountResult>('/api/garage/notifications/unread-count', {
    method: 'GET',
    token,
  });
}
