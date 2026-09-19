import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../contracts/auth.contract';
import {
  CreatedReport,
  CreateReportDto,
} from '../../contracts/report.contract';
import { DatabaseService } from '../../database/database.service';

/**
 * Purpose: accept driver reports on public setup sheets, other drivers, and public Pit Notes without letting the last admin be targeted.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly database: DatabaseService) {}

  async createReport(
    reporter: AuthenticatedUser,
    dto: CreateReportDto,
  ): Promise<CreatedReport> {
    if (dto.targetType === 'user' && dto.targetId === reporter.id) {
      throw new BadRequestException('Cannot report yourself');
    }

    if (dto.targetType === 'setup') {
      const setupRes = await this.database.query<{
        id: string;
        user_id: string;
        is_public: boolean;
      }>('SELECT id, user_id, is_public FROM setups WHERE id = $1', [
        dto.targetId,
      ]);
      const setup = setupRes.rows[0];
      if (!setup || setup.is_public !== true) {
        throw new NotFoundException('Setup not found');
      }
      if (setup.user_id === reporter.id) {
        throw new BadRequestException('Cannot report yourself');
      }
    } else if (dto.targetType === 'comment') {
      const commentRes = await this.database.query<{
        id: string;
        author_user_id: string;
        is_hidden: boolean;
      }>(
        'SELECT id, author_user_id, is_hidden FROM setup_comments WHERE id = $1',
        [dto.targetId],
      );
      const comment = commentRes.rows[0];
      if (!comment || comment.is_hidden) {
        throw new NotFoundException('Comment not found');
      }
      if (comment.author_user_id === reporter.id) {
        throw new BadRequestException('Cannot report yourself');
      }
    } else {
      const userRes = await this.database.query<{
        id: string;
        role: string;
        is_suspended: boolean;
      }>('SELECT id, role, is_suspended FROM users WHERE id = $1', [
        dto.targetId,
      ]);
      const target = userRes.rows[0];
      if (!target) {
        throw new NotFoundException('User not found');
      }
      if (target.role === 'admin' && target.is_suspended === false) {
        const adminCountRes = await this.database.query<{
          count: string | number;
        }>(
          `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_suspended = FALSE`,
        );
        if (Number(adminCountRes.rows[0]?.count ?? 0) <= 1) {
          throw new ForbiddenException(
            'Cannot report the last remaining active admin account',
          );
        }
      }
    }

    const duplicate = await this.database.query<{ id: string }>(
      `SELECT id FROM content_reports
       WHERE reporter_user_id = $1
         AND target_type = $2
         AND target_id = $3
         AND status = 'open'
       LIMIT 1`,
      [reporter.id, dto.targetType, dto.targetId],
    );
    if (duplicate.rows[0]) {
      throw new ConflictException('An open report already exists for this target');
    }

    const inserted = await this.database.query<{ id: string }>(
      `INSERT INTO content_reports (
         reporter_user_id, target_type, target_id, reason_code, details, status
       ) VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING id`,
      [
        reporter.id,
        dto.targetType,
        dto.targetId,
        dto.reasonCode,
        dto.details?.trim() ? dto.details.trim() : null,
      ],
    );
    const row = inserted.rows[0];
    if (!row) {
      throw new BadRequestException('Unable to create report');
    }
    return { id: row.id, status: 'open' };
  }
}
