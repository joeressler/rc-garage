import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../contracts/auth.contract';
import {
  CreateSetupDto,
  CreateSetupSchema,
  DeleteSetupResult,
  ListSetupsQuery,
  ListSetupsQuerySchema,
  SetupDetailEntity,
  SetupEntity,
  SetupIdSchema,
  SetupSummary,
  UpdateSetupDto,
  UpdateSetupSchema,
} from '../../contracts/setup.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { SetupsService } from './setups.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

interface OptionalAuthRequest extends Request {
  user?: AuthenticatedUser;
}

@Controller('setups')
export class SetupsController {
  constructor(private readonly setupsService: SetupsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateSetupSchema)) dto: CreateSetupDto,
  ): Promise<SetupEntity> {
    return this.setupsService.create(request.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(ListSetupsQuerySchema))
    query: ListSetupsQuery,
  ): Promise<SetupSummary[]> {
    return this.setupsService.list(request.user.id, query.vehicleId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Req() request: OptionalAuthRequest,
    @Param('id', new ZodValidationPipe(SetupIdSchema)) id: string,
  ): Promise<SetupDetailEntity> {
    return this.setupsService.findOne(id, request.user?.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(SetupIdSchema)) id: string,
    @Body(new ZodValidationPipe(UpdateSetupSchema)) dto: UpdateSetupDto,
  ): Promise<SetupEntity> {
    return this.setupsService.update(request.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(SetupIdSchema)) id: string,
  ): Promise<DeleteSetupResult> {
    return this.setupsService.remove(request.user.id, id);
  }
}
