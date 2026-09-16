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
  CreateVehicleDto,
  CreateVehicleSchema,
  DeleteVehicleResult,
  ListVehiclesQuery,
  ListVehiclesQuerySchema,
  UpdateVehicleDto,
  UpdateVehicleSchema,
  VehicleEntity,
  VehicleIdSchema,
  VehicleWithSetupsEntity,
} from '../../contracts/vehicle.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VehiclesService } from './vehicles.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateVehicleSchema)) dto: CreateVehicleDto,
  ): Promise<VehicleEntity> {
    return this.vehiclesService.create(request.user.id, dto);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(ListVehiclesQuerySchema))
    query: ListVehiclesQuery,
  ): Promise<VehicleEntity[]> {
    return this.vehiclesService.list(request.user.id, query.archived);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(VehicleIdSchema)) id: string,
  ): Promise<VehicleWithSetupsEntity> {
    return this.vehiclesService.findOne(request.user.id, id);
  }

  @Put(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(VehicleIdSchema)) id: string,
    @Body(new ZodValidationPipe(UpdateVehicleSchema)) dto: UpdateVehicleDto,
  ): Promise<VehicleEntity> {
    return this.vehiclesService.update(request.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(VehicleIdSchema)) id: string,
  ): Promise<DeleteVehicleResult> {
    return this.vehiclesService.remove(request.user.id, id);
  }
}
