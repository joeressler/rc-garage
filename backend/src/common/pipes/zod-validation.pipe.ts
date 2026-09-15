import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodTypeAny } from 'zod';

/**
 * Purpose: enforce request payloads against a passed Zod schema for REST contracts.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodTypeAny) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (!this.schema) {
      return value;
    }

    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      });
      throw new BadRequestException(messages);
    }

    return parsed.data;
  }
}
