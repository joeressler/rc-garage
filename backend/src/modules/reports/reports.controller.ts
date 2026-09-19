import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../../contracts/auth.contract';
import {
  CreatedReport,
  CreateReportDto,
  CreateReportSchema,
} from '../../contracts/report.contract';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Purpose: expose the authenticated driver report intake used by inspect overlay and ReportSetupModal.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateReportSchema)) dto: CreateReportDto,
  ): Promise<CreatedReport> {
    return this.reportsService.createReport(req.user, dto);
  }
}
