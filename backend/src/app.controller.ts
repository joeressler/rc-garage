import { Controller, Get } from '@nestjs/common';

/**
 * Purpose: satisfy the compose healthcheck at /api/garage/health.
 */
@Controller()
export class AppController {
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
