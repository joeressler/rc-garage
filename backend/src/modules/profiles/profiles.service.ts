import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedQueryDto } from '../../contracts/feed.contract';
import {
  ProfileQueryDto,
  PublicDriverProfile,
} from '../../contracts/profile.contract';
import { DatabaseService } from '../../database/database.service';
import { FeedService } from '../feed/feed.service';

interface ProfileUserRow {
  id: string;
  callsign: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: Date | string;
  is_suspended: boolean;
}

/**
 * Purpose: resolve a public driver garage without leaking private pits, emails, or ban metadata.
 */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly feedService: FeedService,
  ) {}

  async getByCallsign(
    callsign: string,
    query: ProfileQueryDto,
    callerId?: string,
  ): Promise<PublicDriverProfile> {
    const userResult = await this.database.query<ProfileUserRow>(
      `SELECT id, callsign, bio, avatar_url, created_at, is_suspended
       FROM users
       WHERE LOWER(callsign) = LOWER($1)
       LIMIT 1`,
      [callsign],
    );

    const user = userResult.rows[0];
    if (!user || user.is_suspended) {
      throw new NotFoundException('Driver not found');
    }

    const countResult = await this.database.query<{ n: string | number }>(
      `SELECT COUNT(*)::int AS n
       FROM setups s
       WHERE s.user_id = $1
         AND s.is_public = TRUE
         AND s.is_hidden = FALSE`,
      [user.id],
    );

    const feedQuery: FeedQueryDto = {
      cursor: query.cursor,
      limit: query.limit,
      sortBy: 'newest',
    };

    const page = await this.feedService.list(feedQuery, callerId, {
      authorUserId: user.id,
    });

    return {
      callsign: user.callsign,
      bio: user.bio,
      avatarUrl: user.avatar_url,
      createdAt: this.toIso(user.created_at),
      publicSetupCount: Number(countResult.rows[0]?.n ?? 0),
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  private toIso(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
