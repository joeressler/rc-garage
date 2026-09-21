import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  MarkNotificationsReadDto,
  NotificationItem,
  NotificationListQuery,
  NotificationType,
  PaginatedNotifications,
  UnreadCountResult,
} from '../../contracts/notification.contract';
import { DatabaseService } from '../../database/database.service';

const COMMENT_PREVIEW_MAX = 140;

export interface NotificationInsertInput {
  type: NotificationType;
  recipientUserId: string;
  actorUserId: string;
  setupId?: string | null;
  commentId?: string | null;
  reportId?: string | null;
  isPublic?: boolean;
}

interface NotificationListRow {
  id: string;
  type: NotificationType;
  created_at: Date | string;
  read_at: Date | string | null;
  actor_callsign: string | null;
  setup_title: string | null;
  setup_id: string | null;
  qr_slug: string | null;
  comment_body: string | null;
  report_status: string | null;
}

/**
 * Purpose: persist pit signals about a driver's public sheets in the same mutation txn, without coalescing likes in v1.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async insertOnClient(
    client: PoolClient,
    input: NotificationInsertInput,
  ): Promise<void> {
    if (input.type !== 'report_outcome') {
      if (input.actorUserId === input.recipientUserId) {
        return;
      }
      if (input.isPublic !== true) {
        return;
      }
    }

    await client.query(
      `INSERT INTO notifications (
         recipient_user_id,
         actor_user_id,
         type,
         setup_id,
         comment_id,
         report_id
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.recipientUserId,
        input.actorUserId,
        input.type,
        input.setupId ?? null,
        input.commentId ?? null,
        input.reportId ?? null,
      ],
    );
  }

  async list(
    recipientUserId: string,
    query: NotificationListQuery,
  ): Promise<PaginatedNotifications> {
    const unreadCount = await this.countUnread(recipientUserId);
    const params: unknown[] = [recipientUserId];
    const where = ['n.recipient_user_id = $1'];

    if (query.unreadOnly) {
      where.push('n.read_at IS NULL');
    }

    if (query.cursor) {
      const cursorRes = await this.database.query<{
        id: string;
        created_at: Date;
      }>(
        `SELECT id, created_at
         FROM notifications
         WHERE id = $1 AND recipient_user_id = $2`,
        [query.cursor, recipientUserId],
      );
      const cursor = cursorRes.rows[0];
      if (!cursor) {
        throw new BadRequestException('Invalid notification cursor');
      }
      params.push(cursor.created_at, cursor.id);
      where.push(
        `(n.created_at, n.id) < ($${params.length - 1}, $${params.length})`,
      );
    }

    const fetchLimit = query.limit + 1;
    params.push(fetchLimit);

    const result = await this.database.query<NotificationListRow>(
      `SELECT
         n.id,
         n.type,
         n.created_at,
         n.read_at,
         actor.callsign AS actor_callsign,
         s.title AS setup_title,
         n.setup_id,
         s.qr_slug,
         c.body AS comment_body,
         r.status AS report_status
       FROM notifications n
       LEFT JOIN users actor ON actor.id = n.actor_user_id
       LEFT JOIN setups s ON s.id = n.setup_id
       LEFT JOIN setup_comments c ON c.id = n.comment_id
       LEFT JOIN content_reports r ON r.id = n.report_id
       WHERE ${where.join(' AND ')}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT $${params.length}`,
      params,
    );

    const hasMore = result.rows.length > query.limit;
    const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((row) => this.toItem(row)),
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
      unreadCount,
    };
  }

  async markRead(
    recipientUserId: string,
    dto: MarkNotificationsReadDto,
  ): Promise<UnreadCountResult> {
    if (dto.ids !== undefined && dto.ids.length === 0) {
      return { unreadCount: await this.countUnread(recipientUserId) };
    }

    if (dto.ids === undefined) {
      await this.database.query(
        `UPDATE notifications
         SET read_at = CURRENT_TIMESTAMP
         WHERE recipient_user_id = $1 AND read_at IS NULL`,
        [recipientUserId],
      );
    } else {
      await this.database.query(
        `UPDATE notifications
         SET read_at = CURRENT_TIMESTAMP
         WHERE recipient_user_id = $1
           AND id = ANY($2::uuid[])
           AND read_at IS NULL`,
        [recipientUserId, dto.ids],
      );
    }

    return { unreadCount: await this.countUnread(recipientUserId) };
  }

  async unreadCount(recipientUserId: string): Promise<UnreadCountResult> {
    return { unreadCount: await this.countUnread(recipientUserId) };
  }

  private async countUnread(recipientUserId: string): Promise<number> {
    const result = await this.database.query<{ count: string | number }>(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE recipient_user_id = $1 AND read_at IS NULL`,
      [recipientUserId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private toItem(row: NotificationListRow): NotificationItem {
    return {
      id: row.id,
      type: row.type,
      createdAt: this.toIso(row.created_at),
      readAt: row.read_at ? this.toIso(row.read_at) : null,
      actorCallsign: row.actor_callsign,
      setupTitle: row.setup_title,
      setupId: row.setup_id,
      qrSlug: row.qr_slug,
      bodyPreview: this.toBodyPreview(row),
    };
  }

  private toBodyPreview(row: NotificationListRow): string | null {
    if (row.type === 'comment') {
      if (!row.comment_body) {
        return null;
      }
      return row.comment_body.length > COMMENT_PREVIEW_MAX
        ? row.comment_body.slice(0, COMMENT_PREVIEW_MAX)
        : row.comment_body;
    }
    if (row.type === 'report_outcome') {
      return row.report_status;
    }
    return null;
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
