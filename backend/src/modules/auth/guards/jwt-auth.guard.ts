import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Purpose: protect private garage routes with a Bearer JWT while preserving 403 for suspended accounts.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: Error | undefined, user: TUser): TUser {
    if (err instanceof ForbiddenException) {
      throw err;
    }
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
