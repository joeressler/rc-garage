import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Purpose: honor THROTTLE_DISABLED only inside NODE_ENV=test so e2e register/login bursts do not flake while production always stays capped.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.THROTTLE_DISABLED === 'true'
    ) {
      return true;
    }
    return super.shouldSkip(context);
  }
}
