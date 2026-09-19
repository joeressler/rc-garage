import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AdminAuditLogQueryDto,
  AdminAuditLogQuerySchema,
  AdminDeleteSetupDto,
  AdminDeleteSetupSchema,
  AdminOverview,
  AdminReportQueryDto,
  AdminReportQuerySchema,
  AdminSetupQueryDto,
  AdminSetupQuerySchema,
  AdminSetupSummary,
  AdminUserQueryDto,
  AdminUserQuerySchema,
  AdminUserSummary,
  ModerateSetupVisibilityDto,
  ModerateSetupVisibilitySchema,
  ModerateUserRoleDto,
  ModerateUserRoleSchema,
  ModerateUserSuspensionDto,
  ModerateUserSuspensionSchema,
  PaginatedAdminReports,
  PaginatedAdminSetups,
  PaginatedAdminUsers,
  PaginatedAuditLog,
  ResolveReportDto,
  ResolveReportSchema,
  AdminReportSummary,
} from '../../contracts/admin.contract';
import { AuthenticatedUser } from '../../contracts/auth.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Purpose: expose role-gated admin endpoints for overview KPIs, driver suspension/roles, setup moderation, and audit logs.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @Roles('admin', 'moderator')
  getOverview(): Promise<AdminOverview> {
    return this.adminService.getOverview();
  }

  @Get('users')
  @Roles('admin', 'moderator')
  listUsers(
    @Query(new ZodValidationPipe(AdminUserQuerySchema))
    query: AdminUserQueryDto,
  ): Promise<PaginatedAdminUsers> {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/suspension')
  @Roles('admin', 'moderator')
  moderateUserSuspension(
    @Req() req: AuthenticatedRequest,
    @Param('id') targetUserId: string,
    @Body(new ZodValidationPipe(ModerateUserSuspensionSchema))
    dto: ModerateUserSuspensionDto,
  ): Promise<AdminUserSummary> {
    return this.adminService.moderateUserSuspension(
      req.user,
      targetUserId,
      dto,
    );
  }

  @Patch('users/:id/role')
  @Roles('admin')
  moderateUserRole(
    @Req() req: AuthenticatedRequest,
    @Param('id') targetUserId: string,
    @Body(new ZodValidationPipe(ModerateUserRoleSchema))
    dto: ModerateUserRoleDto,
  ): Promise<AdminUserSummary> {
    return this.adminService.moderateUserRole(req.user, targetUserId, dto);
  }

  @Get('setups')
  @Roles('admin', 'moderator')
  listSetups(
    @Query(new ZodValidationPipe(AdminSetupQuerySchema))
    query: AdminSetupQueryDto,
  ): Promise<PaginatedAdminSetups> {
    return this.adminService.listSetups(query);
  }

  @Patch('setups/:id/visibility')
  @Roles('admin', 'moderator')
  moderateSetupVisibility(
    @Req() req: AuthenticatedRequest,
    @Param('id') setupId: string,
    @Body(new ZodValidationPipe(ModerateSetupVisibilitySchema))
    dto: ModerateSetupVisibilityDto,
  ): Promise<AdminSetupSummary> {
    return this.adminService.moderateSetupVisibility(req.user, setupId, dto);
  }

  @Delete('setups/:id')
  @Roles('admin')
  deleteSetup(
    @Req() req: AuthenticatedRequest,
    @Param('id') setupId: string,
    @Body(new ZodValidationPipe(AdminDeleteSetupSchema))
    dto: AdminDeleteSetupDto,
  ): Promise<{ deleted: true; id: string }> {
    return this.adminService.deleteSetup(req.user, setupId, dto);
  }

  @Get('audit-log')
  @Roles('admin', 'moderator')
  listAuditLog(
    @Query(new ZodValidationPipe(AdminAuditLogQuerySchema))
    query: AdminAuditLogQueryDto,
  ): Promise<PaginatedAuditLog> {
    return this.adminService.listAuditLog(query);
  }

  @Get('reports')
  @Roles('admin', 'moderator')
  listReports(
    @Query(new ZodValidationPipe(AdminReportQuerySchema))
    query: AdminReportQueryDto,
  ): Promise<PaginatedAdminReports> {
    return this.adminService.listReports(query);
  }

  @Patch('reports/:id')
  @Roles('admin', 'moderator')
  resolveReport(
    @Req() req: AuthenticatedRequest,
    @Param('id') reportId: string,
    @Body(new ZodValidationPipe(ResolveReportSchema)) dto: ResolveReportDto,
  ): Promise<AdminReportSummary> {
    return this.adminService.resolveReport(req.user, reportId, dto);
  }
}
