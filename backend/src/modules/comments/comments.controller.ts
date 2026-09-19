import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../contracts/auth.contract';
import {
  CommentIdSchema,
  CreateCommentDto,
  CreateCommentSchema,
  DeleteCommentResult,
  ListCommentsQuery,
  ListCommentsQuerySchema,
  PaginatedComments,
  SetupComment,
} from '../../contracts/comment.contract';
import { SetupIdSchema } from '../../contracts/setup.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CommentsService } from './comments.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

interface OptionalAuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Purpose: nest list/create under public setups while keeping author delete on a comment-id route that moderators do not share.
 */
@Controller('setups')
export class SetupCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Req() request: OptionalAuthRequest,
    @Param('id', new ZodValidationPipe(SetupIdSchema)) setupId: string,
    @Query(new ZodValidationPipe(ListCommentsQuerySchema))
    query: ListCommentsQuery,
  ): Promise<PaginatedComments> {
    return this.commentsService.list(setupId, query, request.user?.id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  create(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(SetupIdSchema)) setupId: string,
    @Body(new ZodValidationPipe(CreateCommentSchema)) dto: CreateCommentDto,
  ): Promise<SetupComment> {
    return this.commentsService.create(setupId, request.user.id, dto);
  }
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(CommentIdSchema)) commentId: string,
  ): Promise<DeleteCommentResult> {
    return this.commentsService.remove(commentId, request.user.id);
  }
}
