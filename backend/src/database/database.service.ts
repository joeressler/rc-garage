import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const MIGRATIONS_TABLE = 'schema_migrations';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const connectionString = this.resolveDatabaseUrl();
    this.pool = new Pool({ connectionString });
    // Verify connectivity early so misconfiguration fails fast at boot.
    await this.pool.query('SELECT 1');
    this.logger.log('PostgreSQL pool ready');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  /**
   * Purpose: expose a typed query helper for later NestJS repositories.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  /**
   * Purpose: hand out a client for multi-statement transactions.
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async migrateUp(): Promise<void> {
    await this.ensureMigrationsTable();
    const pending = await this.listPendingMigrations();
    for (const name of pending) {
      const sql = await this.readMigrationFile(`${name}.up.sql`);
      const client = await this.getClient();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`,
          [name],
        );
        await client.query('COMMIT');
        this.logger.log(`Applied migration ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  async migrateDown(): Promise<void> {
    await this.ensureMigrationsTable();
    const applied = await this.listAppliedMigrations();
    if (applied.length === 0) {
      this.logger.log('No migrations to roll back');
      return;
    }

    const name = applied[applied.length - 1];
    const sql = await this.readMigrationFile(`${name}.down.sql`);
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [
        name,
      ]);
      await client.query('COMMIT');
      this.logger.log(`Rolled back migration ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private resolveDatabaseUrl(): string {
    const url =
      this.configService.get<string>('DATABASE_URL') ??
      process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is required');
    }
    return url;
  }

  private async resolveMigrationsPath(): Promise<string> {
    const candidates = [
      path.join(__dirname, 'migrations'),
      path.join(process.cwd(), 'src', 'database', 'migrations'),
      path.join(process.cwd(), 'dist', 'database', 'migrations'),
    ];
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // try next
      }
    }
    throw new Error(
      `Migrations directory not found. Tried: ${candidates.join(', ')}`,
    );
  }

  private async ensureMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
  }

  private async listAppliedMigrations(): Promise<string[]> {
    const result = await this.pool.query<{ name: string }>(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`,
    );
    return result.rows.map((row) => row.name);
  }

  private async listPendingMigrations(): Promise<string[]> {
    const dir = await this.resolveMigrationsPath();
    const files = await fs.readdir(dir);
    const ups = files
      .filter((f) => f.endsWith('.up.sql'))
      .map((f) => f.replace(/\.up\.sql$/, ''))
      .sort();
    const applied = new Set(await this.listAppliedMigrations());
    return ups.filter((name) => !applied.has(name));
  }

  private async readMigrationFile(fileName: string): Promise<string> {
    const dir = await this.resolveMigrationsPath();
    return fs.readFile(path.join(dir, fileName), 'utf8');
  }
}
