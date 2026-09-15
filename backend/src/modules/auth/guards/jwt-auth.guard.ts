import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Purpose: protect private garage routes with a Bearer JWT.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
