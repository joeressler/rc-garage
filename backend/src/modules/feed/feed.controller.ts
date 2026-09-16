import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../contracts/auth.contract';
import {
  FeedQueryDto,
  FeedQuerySchema,
  PaginatedFeedResponse,
} from '../../contracts/feed.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { FeedService } from './feed.service';

interface OptionalAuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Purpose: expose the unauthenticated community setup discovery feed.
 */
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Req() request: OptionalAuthRequest,
    @Query(new ZodValidationPipe(FeedQuerySchema)) query: FeedQueryDto,
  ): Promise<PaginatedFeedResponse> {
    return this.feedService.list(query, request.user?.id);
  }
}
