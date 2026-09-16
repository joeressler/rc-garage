import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../contracts/auth.contract';
import { DatabaseService } from '../../database/database.service';

/**
 * Purpose: resolve a Bearer JWT into the authenticated driver attached to the request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly database: DatabaseService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const result = await this.database.query<{
      id: string;
      callsign: string;
      email: string;
    }>('SELECT id, callsign, email FROM users WHERE id = $1', [payload.sub]);

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      callsign: user.callsign,
      email: user.email,
    };
  }
}
