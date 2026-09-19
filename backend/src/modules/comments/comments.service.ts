import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateCommentDto,
  DeleteCommentResult,
  ListCommentsQuery,
  PaginatedComments,
  SetupComment,
} from '../../contracts/comment.contract';
import { DatabaseService } from '../../database/database.service';

const COMMENT_RATE_WINDOW_MS = 15_000;
const PRIVATE_SHEET_COMMENT_MESSAGE =
  'Comments are only available on public sheets';

interface SetupAccessRow {
  id: string;
  user_id: string;
  is_public: boolean;
  is_hidden: boolean;
}

interface CommentDbRow {
  id: string;
  setup_id: string;
  author_user_id: string;
  body: string;
  created_at: Date | string;
  callsign: string;
  avatar_url: string | null;
}

/**
 * Purpose: keep Pit Notes as a flat, public-sheet annotation — rate-limited and stripped of control chars so inspect overlays stay a spec discussion, not a chat product.
 */
@Injectable()
export class CommentsService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    setupId: string,
    query: ListCommentsQuery,
    callerId?: string,
  ): Promise<PaginatedComments> {
    await this.assertCommentsReadable(setupId, callerId);

    const params: unknown[] = [setupId];
    const where = ['c.setup_id = $1', 'c.is_hidden = FALSE'];

    if (query.cursor) {
      const cursorRes = await this.database.query<{
        id: string;
        created_at: Date;
      }>(
        `SELECT id, created_at
         FROM setup_comments
         WHERE id = $1 AND setup_id = $2 AND is_hidden = FALSE`,
        [query.cursor, setupId],
      );
      const cursor = cursorRes.rows[0];
      if (!cursor) {
        throw new BadRequestException('Invalid comment cursor');
      }
      params.push(cursor.created_at, cursor.id);
      where.push(
        `(c.created_at, c.id) > ($${params.length - 1}, $${params.length})`,
      );
    }

    const fetchLimit = query.limit + 1;
    params.push(fetchLimit);

    const result = await this.database.query<CommentDbRow>(
      `SELECT
         c.id,
         c.setup_id,
         c.author_user_id,
         c.body,
         c.created_at,
         u.callsign,
         u.avatar_url
       FROM setup_comments c
       JOIN users u ON u.id = c.author_user_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT $${params.length}`,
      params,
    );

    const hasMore = result.rows.length > query.limit;
    const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((row) => this.toComment(row, callerId)),
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
    };
  }

  async create(
    setupId: string,
    callerId: string,
    dto: CreateCommentDto,
  ): Promise<SetupComment> {
    const body = this.sanitizeBody(dto.body);
    if (!body) {
      throw new BadRequestException('body must not be empty');
    }

    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');

      const setupRes = await client.query<SetupAccessRow>(
        `SELECT id, user_id, is_public, is_hidden
         FROM setups
         WHERE id = $1
         FOR UPDATE`,
        [setupId],
      );
      this.assertCommentsWritable(setupRes.rows[0], callerId);

      const lastRes = await client.query<{ created_at: Date }>(
        `SELECT created_at
         FROM setup_comments
         WHERE setup_id = $1 AND author_user_id = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [setupId, callerId],
      );
      const lastAt = lastRes.rows[0]?.created_at;
      if (lastAt && Date.now() - new Date(lastAt).getTime() < COMMENT_RATE_WINDOW_MS) {
        throw new HttpException(
          'Wait 15 seconds before posting another note on this sheet',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO setup_comments (setup_id, author_user_id, body)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [setupId, callerId, body],
      );
      const commentId = inserted.rows[0]?.id;
      if (!commentId) {
        throw new BadRequestException('Unable to create comment');
      }

      const rowRes = await client.query<CommentDbRow>(
        `SELECT
           c.id,
           c.setup_id,
           c.author_user_id,
           c.body,
           c.created_at,
           u.callsign,
           u.avatar_url
         FROM setup_comments c
         JOIN users u ON u.id = c.author_user_id
         WHERE c.id = $1`,
        [commentId],
      );
      const row = rowRes.rows[0];
      if (!row) {
        throw new BadRequestException('Unable to create comment');
      }

      await client.query('COMMIT');
      return this.toComment(row, callerId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async remove(commentId: string, callerId: string): Promise<DeleteCommentResult> {
    const rowRes = await this.database.query<{
      id: string;
      author_user_id: string;
    }>('SELECT id, author_user_id FROM setup_comments WHERE id = $1', [
      commentId,
    ]);
    const row = rowRes.rows[0];
    if (!row) {
      throw new NotFoundException('Comment not found');
    }
    if (row.author_user_id !== callerId) {
      throw new ForbiddenException('Only the author can delete this comment');
    }

    await this.database.query('DELETE FROM setup_comments WHERE id = $1', [
      commentId,
    ]);
    return { deleted: true, id: commentId };
  }

  private async assertCommentsReadable(
    setupId: string,
    callerId?: string,
  ): Promise<void> {
    const setupRes = await this.database.query<SetupAccessRow>(
      'SELECT id, user_id, is_public, is_hidden FROM setups WHERE id = $1',
      [setupId],
    );
    this.assertCommentsWritable(setupRes.rows[0], callerId);
  }

  private assertCommentsWritable(
    setup: SetupAccessRow | undefined,
    callerId?: string,
  ): void {
    if (!setup || setup.is_hidden) {
      throw new NotFoundException('Setup not found');
    }
    if (!setup.is_public) {
      if (callerId !== undefined && callerId === setup.user_id) {
        throw new ForbiddenException(PRIVATE_SHEET_COMMENT_MESSAGE);
      }
      throw new NotFoundException('Setup not found');
    }
  }

  /**
   * Purpose: keep stored Pit Notes as plain text with newlines, without ASCII control spam that would bypass trim-only Zod checks.
   */
  private sanitizeBody(body: string): string {
    return body.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
  }

  private toComment(row: CommentDbRow, callerId?: string): SetupComment {
    return {
      id: row.id,
      setupId: row.setup_id,
      body: row.body,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
      author: {
        callsign: row.callsign,
        avatarUrl: row.avatar_url,
      },
      isAuthor: callerId !== undefined && callerId === row.author_user_id,
    };
  }
}
