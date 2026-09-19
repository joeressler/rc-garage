import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../contracts/auth.contract';
import {
  CallsignParamSchema,
  ProfileQueryDto,
  ProfileQuerySchema,
  PublicDriverProfile,
} from '../../contracts/profile.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ProfilesService } from './profiles.service';

interface OptionalAuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Purpose: expose a public callsign garage of non-hidden public setup sheets.
 */
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':callsign')
  @UseGuards(OptionalJwtAuthGuard)
  getByCallsign(
    @Req() request: OptionalAuthRequest,
    @Param('callsign', new ZodValidationPipe(CallsignParamSchema))
    callsign: string,
    @Query(new ZodValidationPipe(ProfileQuerySchema)) query: ProfileQueryDto,
  ): Promise<PublicDriverProfile> {
    return this.profilesService.getByCallsign(
      callsign,
      query,
      request.user?.id,
    );
  }
}
