import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  AuthMeResponse,
  AuthTokenResponse,
  UserLoginDto,
  UserProfile,
  UserRegistrationDto,
} from '../../contracts/auth.contract';
import { DatabaseService } from '../../database/database.service';

const BCRYPT_COST = 12;

interface UserRow {
  id: string;
  callsign: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
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
 * Purpose: register, authenticate, and load driver identity without exposing password hashes.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: UserRegistrationDto): Promise<AuthTokenResponse> {
    const email = dto.email.toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    try {
      const result = await this.database.query<UserRow>(
        `INSERT INTO users (email, password_hash, callsign)
         VALUES ($1, $2, $3)
         RETURNING id, callsign, email, avatar_url, bio, created_at`,
        [email, passwordHash, dto.callsign],
      );
      return this.toTokenResponse(result.rows[0]);
    } catch (error) {
      this.throwIfUniqueViolation(error);
      throw error;
    }
  }

  async login(dto: UserLoginDto): Promise<AuthTokenResponse> {
    const email = dto.email.toLowerCase();
    const result = await this.database.query<UserAuthRow>(
      `SELECT id, callsign, email, avatar_url, bio, created_at, password_hash
       FROM users
       WHERE email = $1`,
      [email],
    );

    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(dto.password, row.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.toTokenResponse(row);
  }

  async getMe(userId: string): Promise<AuthMeResponse> {
    const result = await this.database.query<AuthMeRow>(
      `SELECT
         u.id,
         u.callsign,
         u.email,
         u.avatar_url,
         u.bio,
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

    return {
      ...this.toProfile(row),
      vehicleCount: Number(row.vehicle_count),
      setupCount: Number(row.setup_count),
    };
  }

  private toTokenResponse(row: UserRow): AuthTokenResponse {
    const user = this.toProfile(row);
    return {
      token: this.jwtService.sign({ sub: user.id, callsign: user.callsign }),
      user,
    };
  }

  private toProfile(row: UserRow): UserProfile {
    const profile: UserProfile = {
      id: row.id,
      callsign: row.callsign,
      email: row.email,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };

    if (row.avatar_url) {
      profile.avatarUrl = row.avatar_url;
    }
    if (row.bio) {
      profile.bio = row.bio;
    }

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
