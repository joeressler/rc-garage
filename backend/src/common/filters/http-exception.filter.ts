import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

const STATUS_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Purpose: emit a uniform error envelope without leaking credentials or raw internals.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = STATUS_ERROR_NAMES[HttpStatus.INTERNAL_SERVER_ERROR];
    let message = ['An unexpected error occurred'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      error = this.resolveErrorName(status, body);
      message = this.normalizeMessage(body);
    } else if (this.isMalformedJson(exception)) {
      status = HttpStatus.BAD_REQUEST;
      error = STATUS_ERROR_NAMES[HttpStatus.BAD_REQUEST];
      message = ['Malformed JSON payload'];
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private isMalformedJson(exception: unknown): boolean {
    if (!(exception instanceof SyntaxError)) {
      return false;
    }
    const parseError = exception as SyntaxError & {
      status?: number;
      type?: string;
    };
    return (
      parseError.status === HttpStatus.BAD_REQUEST ||
      parseError.type === 'entity.parse.failed'
    );
  }

  private resolveErrorName(status: number, body: string | object): string {
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
    ) {
      return (body as { error: string }).error;
    }
    return STATUS_ERROR_NAMES[status] ?? 'Error';
  }

  private normalizeMessage(payload: string | object): string[] {
    if (typeof payload === 'string') {
      return [payload];
    }
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const raw = (payload as { message: unknown }).message;
      if (Array.isArray(raw)) {
        return raw.map((item) => String(item));
      }
      if (typeof raw === 'string') {
        return [raw];
      }
    }
    return ['An unexpected error occurred'];
  }
}
