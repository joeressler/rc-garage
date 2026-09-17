import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FeedItem,
  FeedQueryDto,
  FeedSortBy,
  PaginatedFeedResponse,
} from '../../contracts/feed.contract';
import { SurfaceType } from '../../contracts/setup.contract';
import { VehicleClass } from '../../contracts/vehicle.contract';
import { DatabaseService } from '../../database/database.service';

interface FeedRow {
  id: string;
  title: string;
  calculated_fdr: string | number;
  front_bias_percentage: string | number;
  surface_type: string;
  fork_count: string | number;
  like_count: string | number;
  qr_slug: string;
  created_at: Date | string;
  callsign: string;
  avatar_url: string | null;
  make: string;
  model: string;
  vehicle_class: string;
  is_liked_by_caller: boolean;
}

interface CursorRow {
  id: string;
  created_at: Date | string;
  fork_count: string | number;
  like_count: string | number;
}

/**
 * Purpose: discover public setup sheets with multi-vector filters and keyset pagination.
 */
@Injectable()
export class FeedService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    query: FeedQueryDto,
    callerId?: string,
  ): Promise<PaginatedFeedResponse> {
    const params: unknown[] = [];
    const where = ['s.is_public = TRUE', 's.is_hidden = FALSE'];

    let likedSql = 'FALSE AS is_liked_by_caller';
    if (callerId) {
      params.push(callerId);
      likedSql = `EXISTS (
         SELECT 1
         FROM setup_likes sl
         WHERE sl.setup_id = s.id
           AND sl.user_id = $1
       ) AS is_liked_by_caller`;
    }

    this.appendEqualityFilter(where, params, 'LOWER(v.make)', query.make, true);
    this.appendEqualityFilter(
      where,
      params,
      'LOWER(v.model)',
      query.model,
      true,
    );
    this.appendEqualityFilter(
      where,
      params,
      'v.vehicle_class',
      query.vehicleClass,
      false,
    );
    this.appendEqualityFilter(
      where,
      params,
      's.surface_type',
      query.surfaceType,
      false,
    );

    if (query.locationTag) {
      params.push(query.locationTag.toLowerCase());
      where.push(
        `s.location_tag IS NOT NULL AND strpos(LOWER(s.location_tag), $${params.length}) > 0`,
      );
    }

    if (query.tag) {
      params.push([query.tag]);
      where.push(`s.tags @> $${params.length}::text[]`);
    }

    if (query.cursor) {
      const cursor = await this.loadCursor(query.cursor);
      if (!cursor) {
        throw new BadRequestException('Invalid feed cursor');
      }
      this.appendKeyset(where, params, query.sortBy, cursor);
    }

    const fetchLimit = query.limit + 1;
    params.push(fetchLimit);
    const limitPlaceholder = `$${params.length}`;

    const result = await this.database.query<FeedRow>(
      `SELECT
         s.id,
         s.title,
         s.calculated_fdr,
         s.front_bias_percentage,
         s.surface_type,
         s.fork_count,
         s.like_count,
         s.qr_slug,
         s.created_at,
         u.callsign,
         u.avatar_url,
         v.make,
         v.model,
         v.vehicle_class,
         ${likedSql}
       FROM setups s
       JOIN vehicles v ON v.id = s.vehicle_id
       JOIN users u ON u.id = s.user_id
       WHERE ${where.join(' AND ')}
       ${this.orderBy(query.sortBy)}
       LIMIT ${limitPlaceholder}`,
      params,
    );

    const hasMore = result.rows.length > query.limit;
    const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((row) => this.toItem(row)),
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
    };
  }

  private appendEqualityFilter(
    where: string[],
    params: unknown[],
    column: string,
    value: string | undefined,
    lowercased: boolean,
  ): void {
    if (!value) {
      return;
    }
    params.push(lowercased ? value.toLowerCase() : value);
    where.push(`${column} = $${params.length}`);
  }

  private appendKeyset(
    where: string[],
    params: unknown[],
    sortBy: FeedSortBy,
    cursor: CursorRow,
  ): void {
    if (sortBy === 'newest') {
      params.push(cursor.created_at, cursor.id);
      where.push(
        `(s.created_at, s.id) < ($${params.length - 1}, $${params.length}::uuid)`,
      );
      return;
    }

    const ranking =
      sortBy === 'most_forked' ? cursor.fork_count : cursor.like_count;
    const rankingColumn =
      sortBy === 'most_forked' ? 's.fork_count' : 's.like_count';
    params.push(ranking, cursor.created_at, cursor.id);
    where.push(
      `(${rankingColumn}, s.created_at, s.id) < ($${params.length - 2}, $${params.length - 1}, $${params.length}::uuid)`,
    );
  }

  private orderBy(sortBy: FeedSortBy): string {
    if (sortBy === 'most_forked') {
      return 'ORDER BY s.fork_count DESC, s.created_at DESC, s.id DESC';
    }
    if (sortBy === 'most_liked') {
      return 'ORDER BY s.like_count DESC, s.created_at DESC, s.id DESC';
    }
    return 'ORDER BY s.created_at DESC, s.id DESC';
  }

  private async loadCursor(cursorId: string): Promise<CursorRow | undefined> {
    const result = await this.database.query<CursorRow>(
      `SELECT id, created_at, fork_count, like_count
       FROM setups
       WHERE id = $1`,
      [cursorId],
    );
    return result.rows[0];
  }

  private toItem(row: FeedRow): FeedItem {
    return {
      id: row.id,
      title: row.title,
      author: {
        callsign: row.callsign,
        avatarUrl: row.avatar_url,
      },
      vehicle: {
        make: row.make,
        model: row.model,
        class: row.vehicle_class as VehicleClass,
      },
      calculatedFdr: Number(row.calculated_fdr),
      frontBiasPercentage: Number(row.front_bias_percentage),
      surfaceType: row.surface_type as SurfaceType,
      forkCount: Number(row.fork_count ?? 0),
      likeCount: Number(row.like_count ?? 0),
      isLikedByCaller: Boolean(row.is_liked_by_caller),
      qrSlug: row.qr_slug,
      createdAt: this.toIso(row.created_at),
    };
  }

  private toIso(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
