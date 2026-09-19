import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  AccountDeletedResult,
  AuthMeResponse,
  AuthTokenResponse,
  ChangeEmailDto,
  ChangePasswordDto,
  DeleteAccountDto,
  PasswordChangedResult,
  UpdateProfileDto,
  UserLoginDto,
  UserProfile,
  UserRegistrationDto,
  UserRole,
} from '../../contracts/auth.contract';
import { DatabaseService } from '../../database/database.service';

const BCRYPT_COST = 12;

interface UserRow {
  id: string;
  callsign: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  is_suspended: boolean;
  created_at: Date | string;
}

interface UserAuthRow extends UserRow {
  password_hash: string;
}

interface AuthMeRow extends UserRow {
  vehicle_count: string | number;
  setup_count: string | number;
}

interface PostgresError {
  code?: string;
  constraint?: string;
  detail?: string;
}

/**
 * Purpose: register, authenticate, promote bootstrap admin, and mutate driver identity without outbound mail.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: UserRegistrationDto): Promise<AuthTokenResponse> {
    const email = dto.email.toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    try {
      const result = await this.database.query<UserRow>(
        `INSERT INTO users (email, password_hash, callsign, age_attested_at, legal_accepted_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, callsign, email, avatar_url, bio, role, is_suspended, created_at`,
        [email, passwordHash, dto.callsign],
      );
      const row = result.rows[0];
      const promoted = await this.maybeBootstrapAdmin(row);
      return this.toTokenResponse(promoted);
    } catch (error) {
      this.throwIfUniqueViolation(error);
      throw error;
    }
  }

  async login(dto: UserLoginDto): Promise<AuthTokenResponse> {
    const email = dto.email.toLowerCase();
    const result = await this.database.query<UserAuthRow>(
      `SELECT id, callsign, email, avatar_url, bio, role, is_suspended, created_at, password_hash
       FROM users
       WHERE email = $1`,
      [email],
    );

    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(dto.password, row.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (row.is_suspended) {
      throw new ForbiddenException('Account suspended');
    }

    const promoted = await this.maybeBootstrapAdmin(row);
    return this.toTokenResponse(promoted);
  }

  async getMe(userId: string): Promise<AuthMeResponse> {
    const result = await this.database.query<AuthMeRow>(
      `SELECT
         u.id,
         u.callsign,
         u.email,
         u.avatar_url,
         u.bio,
         u.role,
         u.is_suspended,
         u.created_at,
         (SELECT COUNT(*)::int FROM vehicles v WHERE v.user_id = u.id) AS vehicle_count,
         (SELECT COUNT(*)::int FROM setups s WHERE s.user_id = u.id) AS setup_count
       FROM users u
       WHERE u.id = $1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException();
    }

    if (row.is_suspended) {
      throw new ForbiddenException('Account suspended');
    }

    return {
      ...this.toProfile(row),
      vehicleCount: Number(row.vehicle_count),
      setupCount: Number(row.setup_count),
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<PasswordChangedResult> {
    if (dto.currentPassword === dto.nextPassword) {
      throw new BadRequestException(
        'Next password must differ from the current password',
      );
    }

    const row = await this.loadAuthRow(userId);
    await this.assertPassword(row, dto.currentPassword);
    const passwordHash = await bcrypt.hash(dto.nextPassword, BCRYPT_COST);
    await this.database.query(
      `UPDATE users
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, userId],
    );
    return { changed: true };
  }

  async changeEmail(userId: string, dto: ChangeEmailDto): Promise<UserProfile> {
    const nextEmail = dto.nextEmail.toLowerCase();
    const row = await this.loadAuthRow(userId);
    await this.assertPassword(row, dto.password);

    if (nextEmail === row.email.toLowerCase()) {
      return this.toProfile(row);
    }

    try {
      const result = await this.database.query<UserRow>(
        `UPDATE users
         SET email = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, callsign, email, avatar_url, bio, role, is_suspended, created_at`,
        [nextEmail, userId],
      );
      return this.toProfile(result.rows[0]);
    } catch (error) {
      this.throwIfUniqueViolation(error);
      throw error;
    }
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    const assignments: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];

    if (dto.bio !== undefined) {
      params.push(dto.bio);
      assignments.push(`bio = $${params.length}`);
    }
    if (dto.avatarUrl !== undefined) {
      params.push(dto.avatarUrl);
      assignments.push(`avatar_url = $${params.length}`);
    }

    params.push(userId);
    const result = await this.database.query<UserRow>(
      `UPDATE users
       SET ${assignments.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, callsign, email, avatar_url, bio, role, is_suspended, created_at`,
      params,
    );
    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException();
    }
    return this.toProfile(row);
  }

  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
  ): Promise<AccountDeletedResult> {
    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query<UserAuthRow>(
        `SELECT id, callsign, email, avatar_url, bio, role, is_suspended, created_at, password_hash
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [userId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new UnauthorizedException();
      }
      if (!(await bcrypt.compare(dto.password, row.password_hash))) {
        throw new UnauthorizedException('Invalid email or password');
      }

      if (row.role === 'admin') {
        const adminCount = await client.query<{ count: string | number }>(
          `SELECT COUNT(*)::int AS count
           FROM users
           WHERE role = 'admin' AND is_suspended = FALSE`,
        );
        if (Number(adminCount.rows[0]?.count ?? 0) <= 1) {
          throw new ConflictException('Cannot delete the last administrator');
        }
      }

      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');
      return { deleted: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async loadAuthRow(userId: string): Promise<UserAuthRow> {
    const result = await this.database.query<UserAuthRow>(
      `SELECT id, callsign, email, avatar_url, bio, role, is_suspended, created_at, password_hash
       FROM users
       WHERE id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException();
    }
    if (row.is_suspended) {
      throw new ForbiddenException('Account suspended');
    }
    return row;
  }

  private async assertPassword(
    row: UserAuthRow,
    password: string,
  ): Promise<void> {
    if (!(await bcrypt.compare(password, row.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  private async maybeBootstrapAdmin(user: UserRow): Promise<UserRow> {
    const bootstrapEmail = (
      this.configService.get<string>('BOOTSTRAP_ADMIN_EMAIL') ??
      process.env.BOOTSTRAP_ADMIN_EMAIL ??
      ''
    )
      .trim()
      .toLowerCase();

    if (!bootstrapEmail || user.email.toLowerCase() !== bootstrapEmail) {
      return user;
    }

    const adminCheck = await this.database.query<{ count: string | number }>(
      `SELECT COUNT(*)::int as count FROM users WHERE role = 'admin'`,
    );
    const existingAdminCount = Number(adminCheck.rows[0]?.count ?? 0);

    if (existingAdminCount === 0 || user.role === 'admin') {
      if (user.role !== 'admin') {
        await this.database.query(
          `UPDATE users SET role = 'admin' WHERE id = $1`,
          [user.id],
        );
        user.role = 'admin';
      }
    }

    return user;
  }

  private toTokenResponse(row: UserRow): AuthTokenResponse {
    const user = this.toProfile(row);
    return {
      token: this.jwtService.sign({
        sub: user.id,
        callsign: user.callsign,
        role: user.role,
      }),
      user,
    };
  }

  private toProfile(row: UserRow): UserProfile {
    const profile: UserProfile = {
      id: row.id,
      callsign: row.callsign,
      email: row.email,
      role: row.role ?? 'driver',
      isSuspended: Boolean(row.is_suspended),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
      avatarUrl: row.avatar_url ?? undefined,
      bio: row.bio ?? undefined,
    };

    return profile;
  }

  private throwIfUniqueViolation(error: unknown): void {
    if (!this.isPostgresError(error) || error.code !== '23505') {
      return;
    }

    const detail = error.detail ?? '';
    if (error.constraint === 'users_email_key' || detail.includes('(email)')) {
      throw new ConflictException('Email is already registered');
    }
    if (
      error.constraint === 'users_callsign_key' ||
      detail.includes('(callsign)')
    ) {
      throw new ConflictException('Callsign is already taken');
    }

    throw new ConflictException('Account already exists');
  }

  private isPostgresError(error: unknown): error is PostgresError {
    return typeof error === 'object' && error !== null;
  }
}
