import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../../contracts/auth.contract';
import {
  MarkNotificationsReadDto,
  MarkNotificationsReadSchema,
  NotificationListQuery,
  NotificationListQuerySchema,
  PaginatedNotifications,
  UnreadCountResult,
} from '../../contracts/notification.contract';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Purpose: expose the authenticated driver's pit-signal inbox over REST so the top-bar bell can poll without sockets.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread-count')
  unreadCount(@Req() request: AuthenticatedRequest): Promise<UnreadCountResult> {
    return this.notificationsService.unreadCount(request.user.id);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(NotificationListQuerySchema))
    query: NotificationListQuery,
  ): Promise<PaginatedNotifications> {
    return this.notificationsService.list(request.user.id, query);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(MarkNotificationsReadSchema))
    dto: MarkNotificationsReadDto,
  ): Promise<UnreadCountResult> {
    return this.notificationsService.markRead(request.user.id, dto);
  }
}
