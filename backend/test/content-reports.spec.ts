/**
 * Milestone 16: authenticated reporter → open queue → moderator hide via report → feed exclusion.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { DatabaseService } from '../src/database/database.service';
import { applyE2eHardeningEnv } from './e2e-env';
import { runContentReportsVerification } from './hardening-reports.spec';

export { runContentReportsVerification };

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone16-e2e-secret';
  }

  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api/garage');
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0, '127.0.0.1');

  const address = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/garage`;
  const database = app.get(DatabaseService);

  try {
    await database.migrateUp();
    await runContentReportsVerification(baseUrl, database);
    console.log('[Content Reports] reporter → queue → hide → feed exclusion passed');
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack ?? error.message : error,
    );
    process.exitCode = 1;
  });
}
