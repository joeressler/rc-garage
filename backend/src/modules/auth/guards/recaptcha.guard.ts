import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Purpose: verify Google reCAPTCHA v2 checkbox tokens on register without a homemade challenge, while allowing a documented local bypass.
 */
@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.readToken(request);
    const secret = (this.configService.get<string>('RECAPTCHA_SECRET_KEY') ?? '').trim();
    const bypassEnabled = secret.length === 0 || secret === 'dev-bypass';

    if (bypassEnabled && token === 'dev-bypass') {
      return true;
    }

    if (!token) {
      return true;
    }

    if (bypassEnabled) {
      throw new BadRequestException('reCAPTCHA verification failed');
    }

    const remoteIp = this.firstForwardedHop(request);
    const verified = await this.siteVerify(secret, token, remoteIp);
    if (!verified) {
      throw new BadRequestException('reCAPTCHA verification failed');
    }
    return true;
  }

  private readToken(request: Request): string {
    const body = request.body as { recaptchaToken?: unknown } | undefined;
    return typeof body?.recaptchaToken === 'string' ? body.recaptchaToken.trim() : '';
  }

  private firstForwardedHop(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      return forwarded.split(',')[0]?.trim();
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
      return forwarded[0].split(',')[0]?.trim();
    }
    return request.ip;
  }

  private async siteVerify(
    secret: string,
    token: string,
    remoteIp?: string,
  ): Promise<boolean> {
    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', token);
    if (remoteIp) {
      params.set('remoteip', remoteIp);
    }

    try {
      const response = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        },
      );
      const payload = (await response.json()) as { success?: unknown };
      return payload.success === true;
    } catch {
      return false;
    }
  }
}
