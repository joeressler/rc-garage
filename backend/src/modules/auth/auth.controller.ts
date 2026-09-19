import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import {
  AccountDeletedResult,
  AuthenticatedUser,
  AuthMeResponse,
  AuthTokenResponse,
  ChangeEmailDto,
  ChangeEmailSchema,
  ChangePasswordDto,
  ChangePasswordSchema,
  DeleteAccountDto,
  DeleteAccountSchema,
  PasswordChangedResult,
  UpdateProfileDto,
  UpdateProfileSchema,
  UserLoginDto,
  UserLoginSchema,
  UserProfile,
  UserRegistrationDto,
  UserRegistrationSchema,
} from '../../contracts/auth.contract';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RecaptchaGuard } from './guards/recaptcha.guard';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(RecaptchaGuard)
  register(
    @Body(new ZodValidationPipe(UserRegistrationSchema))
    dto: UserRegistrationDto,
  ): Promise<AuthTokenResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
  ): Promise<PasswordChangedResult> {
    return this.authService.changePassword(request.user.id, dto);
  }

  @Post('change-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changeEmail(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(ChangeEmailSchema)) dto: ChangeEmailDto,
  ): Promise<UserProfile> {
    return this.authService.changeEmail(request.user.id, dto);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.authService.updateProfile(request.user.id, dto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  deleteAccount(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(DeleteAccountSchema)) dto: DeleteAccountDto,
  ): Promise<AccountDeletedResult> {
    return this.authService.deleteAccount(request.user.id, dto);
  }
}
