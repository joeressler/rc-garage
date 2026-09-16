/**
 * Purpose: exercise Milestone 4 vehicle fleet routes against PostgreSQL and JWT auth.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { DatabaseService } from '../src/database/database.service';

interface Envelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: string;
  message?: string[];
}

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone4-e2e-secret';
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
  const stamp = Date.now();

  const userA = {
    email: `crawler.a.${stamp}@example.com`,
    password: 'pit-mat-pass-1',
    callsign: `crawler_a_${stamp}`.slice(0, 30),
  };
  const userB = {
    email: `crawler.b.${stamp}@example.com`,
    password: 'pit-mat-pass-2',
    callsign: `crawler_b_${stamp}`.slice(0, 30),
  };

  try {
    await database.migrateUp();

    const unauth = await request(baseUrl, 'GET', '/vehicles');
    assert(unauth.status === 401, `expected 401 without JWT, got ${unauth.status}`);
    assert(unauth.body.success === false, 'unauthenticated envelope should fail');

    const registerA = await request(baseUrl, 'POST', '/auth/register', {
      body: userA,
    });
    assert(registerA.status === 201, `register A failed: ${registerA.status}`);
    const tokenA = registerA.body.data.token as string;

    const registerB = await request(baseUrl, 'POST', '/auth/register', {
      body: userB,
    });
    assert(registerB.status === 201, `register B failed: ${registerB.status}`);
    const tokenB = registerB.body.data.token as string;

    const invalidScale = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Bad Scale Rig',
        make: 'Axial',
        model: 'Capra',
        scale: '1/12',
      },
    });
    assert(invalidScale.status === 400, `invalid scale should 400, got ${invalidScale.status}`);
    assert(
      JSON.stringify(invalidScale.body.message).includes('scale'),
      'invalid scale should mention scale',
    );

    const invalidClass = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Bad Class Rig',
        make: 'Traxxas',
        model: 'Slash',
        vehicleClass: 'not_a_class',
      },
    });
    assert(
      invalidClass.status === 400,
      `invalid class should 400, got ${invalidClass.status}`,
    );
    assert(
      JSON.stringify(invalidClass.body.message).includes('vehicleClass'),
      'invalid class should mention vehicleClass',
    );

    const created = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Phoenix Trail Rig',
        make: 'Vanquish',
        model: 'VS4-10 Phoenix',
      },
    });
    assert(created.status === 201, `create vehicle failed: ${created.status}`);
    assert(created.body.success === true, 'create should succeed');
    const vehicle = created.body.data as {
      id: string;
      scale: string;
      vehicleClass: string;
      setupCount: number;
      isArchived: boolean;
      userId: string;
    };
    assert(vehicle.scale === '1/10', 'default scale should be 1/10');
    assert(
      vehicle.vehicleClass === 'crawler_scale',
      'default class should be crawler_scale',
    );
    assert(vehicle.setupCount === 0, 'new chassis should have zero setups');
    assert(vehicle.isArchived === false, 'new chassis should be active');

    const listed = await request(baseUrl, 'GET', '/vehicles', { token: tokenA });
    assert(listed.status === 200, `list failed: ${listed.status}`);
    const fleet = listed.body.data as Array<{ id: string; setupCount: number }>;
    assert(
      fleet.some((item) => item.id === vehicle.id && item.setupCount === 0),
      'list should include the new chassis with a setup count',
    );

    const detail = await request(baseUrl, 'GET', `/vehicles/${vehicle.id}`, {
      token: tokenA,
    });
    assert(detail.status === 200, `detail failed: ${detail.status}`);
    assert(Array.isArray(detail.body.data.setups), 'detail should include setups');
    assert(detail.body.data.setups.length === 0, 'new chassis has no setups');

    const foreignGet = await request(baseUrl, 'GET', `/vehicles/${vehicle.id}`, {
      token: tokenB,
    });
    assert(foreignGet.status === 404, `foreign get should 404, got ${foreignGet.status}`);

    const foreignPut = await request(baseUrl, 'PUT', `/vehicles/${vehicle.id}`, {
      token: tokenB,
      body: { name: 'Stolen Rig' },
    });
    assert(foreignPut.status === 404, `foreign put should 404, got ${foreignPut.status}`);

    const foreignDelete = await request(
      baseUrl,
      'DELETE',
      `/vehicles/${vehicle.id}`,
      { token: tokenB },
    );
    assert(
      foreignDelete.status === 404,
      `foreign delete should 404, got ${foreignDelete.status}`,
    );

    const updated = await request(baseUrl, 'PUT', `/vehicles/${vehicle.id}`, {
      token: tokenA,
      body: {
        name: 'Rubicon Spec Phoenix',
        scale: '1/8',
        vehicleClass: 'comp_crawler_pro',
      },
    });
    assert(updated.status === 200, `update failed: ${updated.status}`);
    assert(updated.body.data.name === 'Rubicon Spec Phoenix', 'name should update');
    assert(updated.body.data.scale === '1/8', 'scale should update');
    assert(
      updated.body.data.vehicleClass === 'comp_crawler_pro',
      'class should update',
    );

    await database.query(
      `INSERT INTO setups (
         vehicle_id, user_id, title, qr_slug, calculated_fdr,
         front_bias_percentage, surface_type, settings, is_public
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, TRUE)`,
      [
        vehicle.id,
        vehicle.userId,
        'Rubicon Low-CoG',
        `pub${stamp}`.slice(0, 16),
        10.8,
        59.2,
        'granite_rock',
        '{}',
      ],
    );

    const withSetup = await request(baseUrl, 'GET', `/vehicles/${vehicle.id}`, {
      token: tokenA,
    });
    assert(withSetup.body.data.setupCount === 1, 'detail setupCount should be 1');
    assert(withSetup.body.data.setups[0].title === 'Rubicon Low-CoG', 'summary title');
    assert(withSetup.body.data.setups[0].isPublic === true, 'summary isPublic');

    const listedWithCount = await request(baseUrl, 'GET', '/vehicles', {
      token: tokenA,
    });
    const counted = (listedWithCount.body.data as Array<{ id: string; setupCount: number }>).find(
      (item) => item.id === vehicle.id,
    );
    assert(counted?.setupCount === 1, 'list setupCount should include linked sheets');

    const softDeleted = await request(
      baseUrl,
      'DELETE',
      `/vehicles/${vehicle.id}`,
      { token: tokenA },
    );
    assert(softDeleted.status === 200, `soft delete failed: ${softDeleted.status}`);
    assert(softDeleted.body.data.deleted === true, 'delete payload should mark deleted');

    const remaining = await request(baseUrl, 'GET', '/vehicles', { token: tokenA });
    assert(
      !(remaining.body.data as Array<{ id: string }>).some((item) => item.id === vehicle.id),
      'archived chassis should drop out of the active fleet list',
    );

    const archivedList = await request(baseUrl, 'GET', '/vehicles?archived=true', {
      token: tokenA,
    });
    assert(
      (archivedList.body.data as Array<{ id: string; isArchived: boolean }>).some(
        (item) => item.id === vehicle.id && item.isArchived,
      ),
      'archived=true should return the soft-deleted chassis',
    );

    const stillPresent = await database.query(
      `SELECT is_archived FROM vehicles WHERE id = $1`,
      [vehicle.id],
    );
    assert(stillPresent.rows[0]?.is_archived === true, 'public setups must keep the chassis row');

    const disposable = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Bash Beater',
        make: 'Arrma',
        model: 'Kraton',
        scale: '1/8',
        vehicleClass: 'monster_truck',
      },
    });
    const disposableId = disposable.body.data.id as string;
    await database.query(
      `INSERT INTO setups (
         vehicle_id, user_id, title, qr_slug, calculated_fdr,
         front_bias_percentage, surface_type, settings, is_public
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, FALSE)`,
      [
        disposableId,
        vehicle.userId,
        'Private Practice',
        `prv${stamp}`.slice(0, 16),
        9.5,
        50.0,
        'packed_dirt',
        '{}',
      ],
    );

    const hardDeleted = await request(baseUrl, 'DELETE', `/vehicles/${disposableId}`, {
      token: tokenA,
    });
    assert(hardDeleted.status === 200, `hard delete failed: ${hardDeleted.status}`);
    const gone = await database.query(`SELECT 1 FROM vehicles WHERE id = $1`, [
      disposableId,
    ]);
    assert(gone.rowCount === 0, 'chassis without public setups should be removed');

    console.log('vehicles fleet e2e: all acceptance checks passed');
  } finally {
    await database.query('DELETE FROM users WHERE email = ANY($1)', [
      [userA.email, userB.email],
    ]);
    await app.close();
  }
}

async function request(
  baseUrl: string,
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Envelope<any> }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const body = (await response.json()) as Envelope<any>;
  return { status: response.status, body };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
