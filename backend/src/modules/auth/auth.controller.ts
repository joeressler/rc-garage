import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AuthenticatedUser,
  AuthMeResponse,
  AuthTokenResponse,
  UserLoginDto,
  UserLoginSchema,
  UserRegistrationDto,
  UserRegistrationSchema,
} from '../../contracts/auth.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(UserRegistrationSchema))
    dto: UserRegistrationDto,
  ): Promise<AuthTokenResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(UserLoginSchema)) dto: UserLoginDto,
  ): Promise<AuthTokenResponse> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): Promise<AuthMeResponse> {
    return this.authService.getMe(request.user.id);
  }
}
