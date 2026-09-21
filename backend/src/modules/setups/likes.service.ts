import { Injectable, NotFoundException } from '@nestjs/common';
import { LikeToggleResult } from '../../contracts/feed.contract';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Purpose: toggle community endorsements without drifting denormalized like counts.
 */
@Injectable()
export class LikesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async toggle(userId: string, setupId: string): Promise<LikeToggleResult> {
    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');
      const setupResult = await client.query<{
        id: string;
        user_id: string;
        is_public: boolean;
      }>(
        `SELECT id, user_id, is_public
         FROM setups
         WHERE id = $1
         FOR UPDATE`,
        [setupId],
      );
      const setup = setupResult.rows[0];
      if (!setup || (!setup.is_public && setup.user_id !== userId)) {
        throw new NotFoundException('Setup not found');
      }

      const existing = await client.query(
        `SELECT 1 FROM setup_likes WHERE user_id = $1 AND setup_id = $2`,
        [userId, setupId],
      );

      if (existing.rows.length > 0) {
        await client.query(
          `DELETE FROM setup_likes WHERE user_id = $1 AND setup_id = $2`,
          [userId, setupId],
        );
        const updated = await client.query<{ like_count: string | number }>(
          `UPDATE setups
           SET like_count = GREATEST(like_count - 1, 0)
           WHERE id = $1
           RETURNING like_count`,
          [setupId],
        );
        await client.query('COMMIT');
        return {
          liked: false,
          likeCount: Number(updated.rows[0].like_count),
        };
      }

      await client.query(
        `INSERT INTO setup_likes (user_id, setup_id) VALUES ($1, $2)`,
        [userId, setupId],
      );
      const updated = await client.query<{ like_count: string | number }>(
        `UPDATE setups
         SET like_count = like_count + 1
         WHERE id = $1
         RETURNING like_count`,
        [setupId],
      );
      await this.notifications.insertOnClient(client, {
        type: 'like',
        recipientUserId: setup.user_id,
        actorUserId: userId,
        setupId,
        isPublic: setup.is_public,
      });
      await client.query('COMMIT');
      return {
        liked: true,
        likeCount: Number(updated.rows[0].like_count),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
