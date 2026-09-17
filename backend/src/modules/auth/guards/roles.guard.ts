import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser, UserRole } from '../../../contracts/auth.contract';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Purpose: enforce role-based access control with admin superset privilege and suspension checks.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.isSuspended) {
      throw new ForbiddenException('Account suspended');
    }

    // Role hierarchy:
    // - admin has access to everything
    // - moderator has access to 'moderator' and 'driver'
    // - driver has access only to 'driver'
    const hasRole = requiredRoles.some((role) => {
      if (user.role === role) {
        return true;
      }
      if (user.role === 'admin') {
        return true;
      }
      if (user.role === 'moderator' && role === 'driver') {
        return true;
      }
      return false;
    });

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role privileges');
    }

    return true;
  }
}
