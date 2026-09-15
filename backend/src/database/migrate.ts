import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

/**
 * Purpose: CLI entry for applying or rolling back SQL migrations without booting the HTTP server.
 */
async function main(): Promise<void> {
  const logger = new Logger('MigrateCLI');
  const direction = process.argv[2];

  if (direction !== 'up' && direction !== 'down') {
    logger.error('Usage: migrate.ts <up|down>');
    process.exitCode = 1;
    return;
  }

  if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL environment variable is required');
    process.exitCode = 1;
    return;
  }

  const configService = new ConfigService(process.env);
  const databaseService = new DatabaseService(configService);

  try {
    await databaseService.onModuleInit();
    if (direction === 'up') {
      await databaseService.migrateUp();
      logger.log('Migrations applied successfully');
    } else {
      await databaseService.migrateDown();
      logger.log('Latest migration rolled back successfully');
    }
  } catch (error) {
    logger.error(
      error instanceof Error ? error.message : 'Migration failed',
      error instanceof Error ? error.stack : undefined,
    );
    process.exitCode = 1;
  } finally {
    await databaseService.onModuleDestroy();
  }
}

main();
