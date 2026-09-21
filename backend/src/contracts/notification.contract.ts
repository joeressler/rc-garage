import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'like',
  'fork',
  'comment',
  'report_outcome',
]);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().optional(),
});

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

export const MarkNotificationsReadSchema = z
  .object({
    ids: z.array(z.string().uuid()).optional(),
  })
  .default({});

export type MarkNotificationsReadDto = z.infer<typeof MarkNotificationsReadSchema>;

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
