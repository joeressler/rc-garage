import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
  timestamp: string;
}

/**
 * Purpose: wrap JSON success payloads in the REST envelope without corrupting binary QR streams.
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, SuccessEnvelope<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T> | T> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (this.isBinaryPayload(data)) {
          return data;
        }
        return {
          success: true as const,
          statusCode: response.statusCode,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private isBinaryPayload(data: T): boolean {
    return data instanceof StreamableFile || Buffer.isBuffer(data);
  }
}
