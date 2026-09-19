import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAuditLogQueryDto,
  AdminDeleteSetupDto,
  AdminOverview,
  AdminSetupQueryDto,
  AdminSetupSummary,
  AdminUserQueryDto,
  AdminUserSummary,
  ModerateSetupVisibilityDto,
  ModerateUserRoleDto,
  ModerateUserSuspensionDto,
  ModerationAuditLogEntry,
  PaginatedAdminSetups,
  PaginatedAdminUsers,
  PaginatedAuditLog,
} from '../../contracts/admin.contract';
import { AuthenticatedUser, UserRole } from '../../contracts/auth.contract';
import { DatabaseService } from '../../database/database.service';

interface UserDbRow {
  id: string;
  callsign: string;
  email: string;
  role: UserRole;
  is_suspended: boolean;
  suspended_at: Date | string | null;
  suspension_reason: string | null;
  avatar_url: string | null;
  bio: string | null;
  vehicle_count: string | number;
  setup_count: string | number;
  created_at: Date | string;
}

interface SetupDbRow {
  id: string;
  title: string;
  vehicle_id: string;
  user_id: string;
  author_callsign: string;
  author_email: string;
  vehicle_name: string;
  vehicle_make: string;
  vehicle_model: string;
  is_public: boolean;
  is_hidden: boolean;
  hidden_at: Date | string | null;
  hidden_reason: string | null;
  fork_count: string | number;
  like_count: string | number;
  qr_slug: string;
  surface_type: string;
  calculated_fdr: string | number;
  front_bias_percentage: string | number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AuditDbRow {
  id: string;
  actor_user_id: string | null;
  actor_callsign: string | null;
  actor_role: UserRole | null;
  action: string;
  target_type: 'user' | 'setup';
  target_id: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date | string;
}

/**
 * Purpose: execute admin console operations, enforce operator safety checks, and record an immutable audit trail.
 */
@Injectable()
export class AdminService {
  constructor(private readonly database: DatabaseService) {}

  async getOverview(): Promise<AdminOverview> {
    const result = await this.database.query<{
      user_count: string | number;
      setup_count: string | number;
      public_setup_count: string | number;
      hidden_setup_count: string | number;
      suspended_user_count: string | number;
      likes_24h: string | number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS user_count,
        (SELECT COUNT(*)::int FROM setups) AS setup_count,
        (SELECT COUNT(*)::int FROM setups WHERE is_public = TRUE) AS public_setup_count,
        (SELECT COUNT(*)::int FROM setups WHERE is_hidden = TRUE) AS hidden_setup_count,
        (SELECT COUNT(*)::int FROM users WHERE is_suspended = TRUE) AS suspended_user_count,
        (SELECT COUNT(*)::int FROM setup_likes WHERE created_at >= NOW() - INTERVAL '24 hours') AS likes_24h
    `);

    const row = result.rows[0];
    return {
      userCount: Number(row?.user_count ?? 0),
      setupCount: Number(row?.setup_count ?? 0),
      publicSetupCount: Number(row?.public_setup_count ?? 0),
      hiddenSetupCount: Number(row?.hidden_setup_count ?? 0),
      suspendedUserCount: Number(row?.suspended_user_count ?? 0),
      likes24h: Number(row?.likes_24h ?? 0),
    };
  }

  async listUsers(query: AdminUserQueryDto): Promise<PaginatedAdminUsers> {
    const params: unknown[] = [];
    const where: string[] = ['1=1'];

    if (query.q) {
      params.push(`%${query.q}%`);
      where.push(
        `(u.callsign ILIKE $${params.length} OR u.email ILIKE $${params.length})`,
      );
    }

    if (query.role) {
      params.push(query.role);
      where.push(`u.role = $${params.length}`);
    }

    if (query.suspended !== undefined) {
      params.push(query.suspended);
      where.push(`u.is_suspended = $${params.length}`);
    }

    if (query.cursor) {
      const cursorRes = await this.database.query<{
        id: string;
        created_at: Date;
      }>('SELECT id, created_at FROM users WHERE id = $1', [query.cursor]);
      const cursorRow = cursorRes.rows[0];
      if (!cursorRow) {
        throw new BadRequestException('Invalid user cursor');
      }
      params.push(cursorRow.created_at, cursorRow.id);
      where.push(
        `(u.created_at, u.id) < ($${params.length - 1}, $${params.length})`,
      );
    }

    const fetchLimit = query.limit + 1;
    params.push(fetchLimit);

    const result = await this.database.query<UserDbRow>(
      `SELECT
         u.id,
         u.callsign,
         u.email,
         u.role,
         u.is_suspended,
         u.suspended_at,
         u.suspension_reason,
         u.avatar_url,
         u.bio,
         u.created_at,
         (SELECT COUNT(*)::int FROM vehicles v WHERE v.user_id = u.id) AS vehicle_count,
         (SELECT COUNT(*)::int FROM setups s WHERE s.user_id = u.id) AS setup_count
       FROM users u
       WHERE ${where.join(' AND ')}
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT $${params.length}`,
      params,
    );

    const hasMore = result.rows.length > query.limit;
    const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((r) => this.toUserSummary(r)),
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
    };
  }

  async moderateUserSuspension(
    actor: AuthenticatedUser,
    targetUserId: string,
    dto: ModerateUserSuspensionDto,
  ): Promise<AdminUserSummary> {
    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');

      const targetRes = await client.query<{
        id: string;
        callsign: string;
        role: UserRole;
        is_suspended: boolean;
      }>('SELECT id, callsign, role, is_suspended FROM users WHERE id = $1 FOR UPDATE', [
        targetUserId,
      ]);
      const target = targetRes.rows[0];
      if (!target) {
        throw new NotFoundException('User not found');
      }

      if (dto.suspend) {
        if (target.role === 'admin') {
          const adminCountRes = await client.query<{ count: string | number }>(
            `SELECT COUNT(*)::int as count FROM users WHERE role = 'admin' AND is_suspended = FALSE`,
          );
          const activeAdmins = Number(adminCountRes.rows[0]?.count ?? 0);
          if (activeAdmins <= 1) {
            throw new ForbiddenException(
              'Cannot suspend the last remaining active admin account',
            );
          }
        }

        await client.query(
          `UPDATE users
           SET is_suspended = TRUE,
               suspended_at = CURRENT_TIMESTAMP,
               suspension_reason = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [dto.reason ?? null, targetUserId],
        );

        await client.query(
          `INSERT INTO moderation_audit_log (actor_user_id, action, target_type, target_id, reason, metadata)
           VALUES ($1, 'user.suspend', 'user', $2, $3, $4)`,
          [
            actor.id,
            targetUserId,
            dto.reason ?? null,
            JSON.stringify({ targetCallsign: target.callsign, targetRole: target.role }),
          ],
        );
      } else {
        await client.query(
          `UPDATE users
           SET is_suspended = FALSE,
               suspended_at = NULL,
               suspension_reason = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [targetUserId],
        );

        await client.query(
          `INSERT INTO moderation_audit_log (actor_user_id, action, target_type, target_id, reason, metadata)
           VALUES ($1, 'user.reinstate', 'user', $2, $3, $4)`,
          [
            actor.id,
            targetUserId,
            dto.reason ?? null,
            JSON.stringify({ targetCallsign: target.callsign, targetRole: target.role }),
          ],
        );
      }

      const updatedRes = await client.query<UserDbRow>(
        `SELECT
           u.id,
           u.callsign,
           u.email,
           u.role,
           u.is_suspended,
           u.suspended_at,
           u.suspension_reason,
           u.avatar_url,
           u.bio,
           u.created_at,
           (SELECT COUNT(*)::int FROM vehicles v WHERE v.user_id = u.id) AS vehicle_count,
           (SELECT COUNT(*)::int FROM setups s WHERE s.user_id = u.id) AS setup_count
         FROM users u
         WHERE u.id = $1`,
        [targetUserId],
      );

      await client.query('COMMIT');
      return this.toUserSummary(updatedRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async moderateUserRole(
    actor: AuthenticatedUser,
    targetUserId: string,
    dto: ModerateUserRoleDto,
  ): Promise<AdminUserSummary> {
    if (actor.id === targetUserId) {
      throw new ForbiddenException(
        'Cannot modify your own administrative role',
      );
    }

    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');

      const targetRes = await client.query<{
        id: string;
        callsign: string;
        role: UserRole;
        is_suspended: boolean;
      }>('SELECT id, callsign, role, is_suspended FROM users WHERE id = $1 FOR UPDATE', [
        targetUserId,
      ]);
      const target = targetRes.rows[0];
      if (!target) {
        throw new NotFoundException('User not found');
      }

      if (target.role === 'admin' && dto.role !== 'admin') {
        const adminCountRes = await client.query<{ count: string | number }>(
          `SELECT COUNT(*)::int as count FROM users WHERE role = 'admin'`,
        );
        const adminCount = Number(adminCountRes.rows[0]?.count ?? 0);
        if (adminCount <= 1) {
          throw new ForbiddenException(
            'Cannot demote the last remaining admin account',
          );
        }
      }

      await client.query(
        `UPDATE users
         SET role = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [dto.role, targetUserId],
      );

      await client.query(
        `INSERT INTO moderation_audit_log (actor_user_id, action, target_type, target_id, reason, metadata)
         VALUES ($1, 'user.role_change', 'user', $2, $3, $4)`,
        [
          actor.id,
          targetUserId,
          dto.reason ?? null,
          JSON.stringify({
            previousRole: target.role,
            newRole: dto.role,
            targetCallsign: target.callsign,
          }),
        ],
      );

      const updatedRes = await client.query<UserDbRow>(
        `SELECT
           u.id,
           u.callsign,
           u.email,
           u.role,
           u.is_suspended,
           u.suspended_at,
           u.suspension_reason,
           u.avatar_url,
           u.bio,
           u.created_at,
           (SELECT COUNT(*)::int FROM vehicles v WHERE v.user_id = u.id) AS vehicle_count,
           (SELECT COUNT(*)::int FROM setups s WHERE s.user_id = u.id) AS setup_count
         FROM users u
         WHERE u.id = $1`,
        [targetUserId],
      );

      await client.query('COMMIT');
      return this.toUserSummary(updatedRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listSetups(query: AdminSetupQueryDto): Promise<PaginatedAdminSetups> {
    const params: unknown[] = [];
    const where: string[] = ['1=1'];

    if (query.q) {
      params.push(`%${query.q}%`);
      where.push(
        `(s.title ILIKE $${params.length} OR v.make ILIKE $${params.length} OR v.model ILIKE $${params.length})`,
      );
    }

    if (query.hidden !== undefined) {
      params.push(query.hidden);
      where.push(`s.is_hidden = $${params.length}`);
    }

    if (query.isPublic !== undefined) {
      params.push(query.isPublic);
      where.push(`s.is_public = $${params.length}`);
    }

    if (query.authorCallsign) {
      params.push(query.authorCallsign.toLowerCase());
      where.push(`LOWER(u.callsign) = $${params.length}`);
    }

    if (query.cursor) {
      const cursorRes = await this.database.query<{
        id: string;
        created_at: Date;
      }>('SELECT id, created_at FROM setups WHERE id = $1', [query.cursor]);
      const cursorRow = cursorRes.rows[0];
      if (!cursorRow) {
        throw new BadRequestException('Invalid setup cursor');
      }
      params.push(cursorRow.created_at, cursorRow.id);
      where.push(
        `(s.created_at, s.id) < ($${params.length - 1}, $${params.length})`,
      );
    }

    const fetchLimit = query.limit + 1;
    params.push(fetchLimit);

    const result = await this.database.query<SetupDbRow>(
      `SELECT
         s.id,
         s.title,
         s.vehicle_id,
         s.user_id,
         u.callsign AS author_callsign,
         u.email AS author_email,
         v.name AS vehicle_name,
         v.make AS vehicle_make,
         v.model AS vehicle_model,
         s.is_public,
         s.is_hidden,
         s.hidden_at,
         s.hidden_reason,
         s.fork_count,
         s.like_count,
         s.qr_slug,
         s.surface_type,
         s.calculated_fdr,
         s.front_bias_percentage,
         s.created_at,
         s.updated_at
       FROM setups s
       JOIN vehicles v ON v.id = s.vehicle_id
       JOIN users u ON u.id = s.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT $${params.length}`,
      params,
    );

    const hasMore = result.rows.length > query.limit;
    const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((r) => this.toSetupSummary(r)),
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
    };
  }

  async moderateSetupVisibility(
    actor: AuthenticatedUser,
    setupId: string,
    dto: ModerateSetupVisibilityDto,
  ): Promise<AdminSetupSummary> {
    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');

      const setupRes = await client.query<{
        id: string;
        title: string;
        is_hidden: boolean;
      }>('SELECT id, title, is_hidden FROM setups WHERE id = $1 FOR UPDATE', [
        setupId,
      ]);
      const setup = setupRes.rows[0];
      if (!setup) {
        throw new NotFoundException('Setup not found');
      }

      if (dto.hide) {
        await client.query(
          `UPDATE setups
           SET is_hidden = TRUE,
               hidden_at = CURRENT_TIMESTAMP,
               hidden_reason = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [dto.reason ?? null, setupId],
        );

        await client.query(
          `INSERT INTO moderation_audit_log (actor_user_id, action, target_type, target_id, reason, metadata)
           VALUES ($1, 'setup.hide', 'setup', $2, $3, $4)`,
          [
            actor.id,
            setupId,
            dto.reason ?? null,
            JSON.stringify({ setupTitle: setup.title }),
          ],
        );
      } else {
        await client.query(
          `UPDATE setups
           SET is_hidden = FALSE,
               hidden_at = NULL,
               hidden_reason = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [setupId],
        );

        await client.query(
          `INSERT INTO moderation_audit_log (actor_user_id, action, target_type, target_id, reason, metadata)
           VALUES ($1, 'setup.unhide', 'setup', $2, $3, $4)`,
          [
            actor.id,
            setupId,
            dto.reason ?? null,
            JSON.stringify({ setupTitle: setup.title }),
          ],
        );
      }

      const updatedRes = await client.query<SetupDbRow>(
        `SELECT
           s.id,
           s.title,
           s.vehicle_id,
           s.user_id,
           u.callsign AS author_callsign,
           u.email AS author_email,
           v.name AS vehicle_name,
           v.make AS vehicle_make,
           v.model AS vehicle_model,
           s.is_public,
           s.is_hidden,
           s.hidden_at,
           s.hidden_reason,
           s.fork_count,
           s.like_count,
           s.qr_slug,
           s.surface_type,
           s.calculated_fdr,
           s.front_bias_percentage,
           s.created_at,
           s.updated_at
         FROM setups s
         JOIN vehicles v ON v.id = s.vehicle_id
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1`,
        [setupId],
      );

      await client.query('COMMIT');
      return this.toSetupSummary(updatedRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteSetup(
    actor: AuthenticatedUser,
    setupId: string,
    dto: AdminDeleteSetupDto,
  ): Promise<{ deleted: true; id: string }> {
    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');

      const setupRes = await client.query<{
        id: string;
        title: string;
        user_id: string;
      }>('SELECT id, title, user_id FROM setups WHERE id = $1 FOR UPDATE', [
        setupId,
      ]);
      const setup = setupRes.rows[0];
      if (!setup) {
        throw new NotFoundException('Setup not found');
      }

      await client.query(
        `INSERT INTO moderation_audit_log (actor_user_id, action, target_type, target_id, reason, metadata)
         VALUES ($1, 'setup.delete', 'setup', $2, $3, $4)`,
        [
          actor.id,
          setupId,
          dto.reason,
          JSON.stringify({
            deletedTitle: setup.title,
            ownerUserId: setup.user_id,
          }),
        ],
      );

      await client.query('DELETE FROM setups WHERE id = $1', [setupId]);

      await client.query('COMMIT');
      return { deleted: true, id: setupId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listAuditLog(query: AdminAuditLogQueryDto): Promise<PaginatedAuditLog> {
    const params: unknown[] = [];
    const where: string[] = ['1=1'];

    if (query.cursor) {
      const cursorRes = await this.database.query<{
        id: string;
        created_at: Date;
      }>('SELECT id, created_at FROM moderation_audit_log WHERE id = $1', [
        query.cursor,
      ]);
      const cursorRow = cursorRes.rows[0];
      if (!cursorRow) {
        throw new BadRequestException('Invalid audit log cursor');
      }
      params.push(cursorRow.created_at, cursorRow.id);
      where.push(
        `(m.created_at, m.id) < ($${params.length - 1}, $${params.length})`,
      );
    }

    const fetchLimit = query.limit + 1;
    params.push(fetchLimit);

    const result = await this.database.query<AuditDbRow>(
      `SELECT
         m.id,
         m.actor_user_id,
         u.callsign AS actor_callsign,
         u.role AS actor_role,
         m.action,
         m.target_type,
         m.target_id,
         m.reason,
         m.metadata,
         m.created_at
       FROM moderation_audit_log m
       LEFT JOIN users u ON u.id = m.actor_user_id
       WHERE ${where.join(' AND ')}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $${params.length}`,
      params,
    );

    const hasMore = result.rows.length > query.limit;
    const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((r) => this.toAuditEntry(r)),
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
    };
  }

  private toUserSummary(r: UserDbRow): AdminUserSummary {
    return {
      id: r.id,
      callsign: r.callsign,
      email: r.email,
      role: r.role,
      isSuspended: Boolean(r.is_suspended),
      suspendedAt: r.suspended_at
        ? new Date(r.suspended_at).toISOString()
        : null,
      suspensionReason: r.suspension_reason,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      vehicleCount: Number(r.vehicle_count),
      setupCount: Number(r.setup_count),
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : new Date(r.created_at).toISOString(),
    };
  }

  private toSetupSummary(r: SetupDbRow): AdminSetupSummary {
    return {
      id: r.id,
      title: r.title,
      vehicleId: r.vehicle_id,
      userId: r.user_id,
      authorCallsign: r.author_callsign,
      authorEmail: r.author_email,
      vehicleName: r.vehicle_name,
      vehicleMake: r.vehicle_make,
      vehicleModel: r.vehicle_model,
      isPublic: Boolean(r.is_public),
      isHidden: Boolean(r.is_hidden),
      hiddenAt: r.hidden_at ? new Date(r.hidden_at).toISOString() : null,
      hiddenReason: r.hidden_reason,
      forkCount: Number(r.fork_count),
      likeCount: Number(r.like_count),
      qrSlug: r.qr_slug,
      surfaceType: r.surface_type,
      calculatedFdr: Number(r.calculated_fdr),
      frontBiasPercentage: Number(r.front_bias_percentage),
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : new Date(r.created_at).toISOString(),
      updatedAt:
        r.updated_at instanceof Date
          ? r.updated_at.toISOString()
          : new Date(r.updated_at).toISOString(),
    };
  }

  private toAuditEntry(r: AuditDbRow): ModerationAuditLogEntry {
    return {
      id: r.id,
      actorUserId: r.actor_user_id,
      actorCallsign: r.actor_callsign ?? 'deleted',
      actorRole: r.actor_role ?? 'driver',
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      metadata: r.metadata ?? {},
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : new Date(r.created_at).toISOString(),
    };
  }
}
