/**
 * Purpose: exercise Milestone 5 setup logging routes, telemetry math, and JSONB persistence.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { DatabaseService } from '../src/database/database.service';
import { SetupSettings } from '../src/contracts/setup.contract';
import { applyE2eHardeningEnv } from './e2e-env';
import {
  applyDerivedTelemetry,
  calculateCogBias,
  calculateFdr,
} from '../src/modules/setups/utils/telemetry-math.util';

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

function shockSpec() {
  return {
    oilViscosityValue: 425,
    oilViscosityUnit: 'CST' as const,
    springRateDescription: '3.2 lb/in',
    shockLengthEyeToEyeMm: 90,
    rideHeightMm: 28,
  };
}

function axleTires() {
  return {
    brand: 'Pit Bull',
    model: 'Predator',
    compound: 'Alien',
  };
}

function buildSettings(
  overrides: {
    pinionTeeth?: number;
    spurTeeth?: number;
    transmissionInternalRatio?: number;
    calculatedFdr?: number;
    portalGearsInstalled?: boolean;
    portalBoxRatio?: number;
    totalRtrWeightGrams?: number;
    frontAxleWeightGrams?: number;
    rearAxleWeightGrams?: number;
    surface?: string;
    locationTag?: string;
  } = {},
) {
  return {
    drivetrain: {
      pinionTeeth: overrides.pinionTeeth ?? 15,
      spurTeeth: overrides.spurTeeth ?? 54,
      transmissionInternalRatio: overrides.transmissionInternalRatio ?? 3,
      ...(overrides.calculatedFdr !== undefined
        ? { calculatedFdr: overrides.calculatedFdr }
        : {}),
    },
    suspension: {
      front: shockSpec(),
      rear: shockSpec(),
      portalGearsInstalled: overrides.portalGearsInstalled ?? false,
      ...(overrides.portalBoxRatio !== undefined
        ? { portalBoxRatio: overrides.portalBoxRatio }
        : {}),
    },
    tiresAndWeight: {
      front: axleTires(),
      rear: axleTires(),
      weight: {
        totalRtrWeightGrams: overrides.totalRtrWeightGrams ?? 2500,
        frontAxleWeightGrams: overrides.frontAxleWeightGrams ?? 1480,
        rearAxleWeightGrams: overrides.rearAxleWeightGrams ?? 1020,
      },
    },
    trackConditions: {
      surface: overrides.surface ?? 'granite_rock',
      grip: 'high',
      locationTag: overrides.locationTag ?? 'Moab Rim',
    },
  };
}

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone5-e2e-secret';
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
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
    callsign: `setup_a_${stamp}`.slice(0, 30),
  };
  const userB = {
    email: `crawler.b.${stamp}@example.com`,
    password: 'pit-mat-pass-2',
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
    callsign: `setup_b_${stamp}`.slice(0, 30),
  };

  try {
    await database.migrateUp();

    for (const [method, path] of [
      ['POST', '/setups'],
      ['GET', '/setups'],
      ['GET', '/setups?vehicleId=00000000-0000-4000-8000-000000000001'],
      ['PUT', '/setups/00000000-0000-4000-8000-000000000001'],
      ['DELETE', '/setups/00000000-0000-4000-8000-000000000001'],
    ] as const) {
      const unauth = await request(baseUrl, method, path, {
        body:
          method === 'POST' || method === 'PUT'
            ? { title: 'Unauthed' }
            : undefined,
      });
      assert(
        unauth.status === 401,
        `expected 401 without JWT for ${method} ${path}, got ${unauth.status}`,
      );
    }

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

    const vehicleA = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Phoenix Trail Rig',
        make: 'Vanquish',
        model: 'VS4-10 Phoenix',
      },
    });
    assert(vehicleA.status === 201, `create vehicle A failed: ${vehicleA.status}`);
    const vehicleAId = vehicleA.body.data.id as string;

    const vehicleB = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenB,
      body: {
        name: 'Capra Trail Rig',
        make: 'Axial',
        model: 'Capra',
      },
    });
    assert(vehicleB.status === 201, `create vehicle B failed: ${vehicleB.status}`);
    const vehicleBId = vehicleB.body.data.id as string;

    const emptyAccountList = await request(baseUrl, 'GET', '/setups', {
      token: tokenA,
    });
    assert(
      emptyAccountList.status === 200,
      `account list without vehicleId should 200, got ${emptyAccountList.status}`,
    );
    assert(
      Array.isArray(emptyAccountList.body.data) && emptyAccountList.body.data.length === 0,
      'new driver should have an empty garage sheet list',
    );

    const badGears = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Illegal Mesh',
        settings: buildSettings({ pinionTeeth: 40, spurTeeth: 32 }),
      },
    });
    assert(badGears.status === 400, `pinion > spur should 400, got ${badGears.status}`);
    assert(
      JSON.stringify(badGears.body.message).includes('spurTeeth'),
      'invalid gearing should mention spurTeeth',
    );

    const badWeight = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Unbalanced Scale',
        settings: buildSettings({
          totalRtrWeightGrams: 2500,
          frontAxleWeightGrams: 1480,
          rearAxleWeightGrams: 1000,
        }),
      },
    });
    assert(
      badWeight.status === 400,
      `weight mismatch >10g should 400, got ${badWeight.status}`,
    );
    assert(
      JSON.stringify(badWeight.body.message).includes('totalRtrWeightGrams'),
      'weight mismatch should mention totalRtrWeightGrams',
    );

    const expectedFdr = calculateFdr({
      pinionTeeth: 15,
      spurTeeth: 54,
      transmissionInternalRatio: 3,
    });
    const expectedCog = calculateCogBias(1480, 2500);
    const stamped = applyDerivedTelemetry(buildSettings() as SetupSettings);
    assert(expectedFdr === 10.8, `base FDR should be 10.8, got ${expectedFdr}`);
    assert(
      expectedCog.frontBiasPercentage === 59.2,
      `front bias should be 59.2, got ${expectedCog.frontBiasPercentage}`,
    );
    assert(
      expectedCog.rearBiasPercentage === 40.8,
      `rear bias should be 40.8, got ${expectedCog.rearBiasPercentage}`,
    );
    assert(
      stamped.calculatedFdr === expectedFdr &&
        stamped.settings.drivetrain.calculatedFdr === expectedFdr,
      'derived settings should stamp FDR',
    );

    const created = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Rubicon Low-CoG',
        description: 'Competition crawl spec',
        tags: ['moab', 'comp'],
        settings: buildSettings({ calculatedFdr: 99.99 }),
      },
    });
    assert(created.status === 201, `create setup failed: ${created.status}`);
    assert(created.body.success === true, 'create should succeed');
    const setup = created.body.data as {
      id: string;
      userId: string;
      vehicleId: string;
      title: string;
      isPublic: boolean;
      calculatedFdr: number;
      frontBiasPercentage: number;
      qrSlug: string;
      surfaceType: string;
      locationTag: string | null;
      settings: {
        drivetrain: { calculatedFdr?: number; pinionTeeth: number };
        tiresAndWeight: {
          weight: {
            frontWeightBiasPercentage?: number;
            rearWeightBiasPercentage?: number;
          };
        };
      };
      forkCount: number;
      likeCount: number;
      forkedFromSetupId: string | null;
    };
    assert(setup.vehicleId === vehicleAId, 'setup should belong to vehicle A');
    assert(setup.calculatedFdr === expectedFdr, `FDR should be ${expectedFdr}`);
    assert(
      setup.frontBiasPercentage === expectedCog.frontBiasPercentage,
      `front bias should be ${expectedCog.frontBiasPercentage}`,
    );
    assert(
      setup.settings.drivetrain.calculatedFdr === expectedFdr,
      'JSONB should contain server FDR, not the client 99.99',
    );
    assert(
      setup.settings.tiresAndWeight.weight.frontWeightBiasPercentage === 59.2,
      'JSONB should contain front CoG bias',
    );
    assert(
      setup.settings.tiresAndWeight.weight.rearWeightBiasPercentage === 40.8,
      'JSONB front+rear bias should equal 100',
    );
    assert(setup.qrSlug.length === 10, 'qr_slug must be 10 characters');
    assert(/^[A-Za-z0-9_-]+$/.test(setup.qrSlug), 'qr_slug must be URL-safe');
    assert(setup.isPublic === true, 'setup should default public');
    assert(setup.surfaceType === 'granite_rock', 'surface should persist');
    assert(setup.locationTag === 'Moab Rim', 'location tag should persist');
    assert(setup.forkCount === 0 && setup.likeCount === 0, 'new sheet has no social stats');
    assert(setup.forkedFromSetupId === null, 'new sheet is not a fork');

    const persisted = await database.query<{
      settings: { drivetrain: { pinionTeeth: number } };
      calculated_fdr: string | number;
    }>(`SELECT settings, calculated_fdr FROM setups WHERE id = $1`, [setup.id]);
    assert(persisted.rowCount === 1, 'setup row should exist in PostgreSQL');
    assert(
      persisted.rows[0].settings.drivetrain.pinionTeeth === 15,
      'JSONB drivetrain should round-trip',
    );
    assert(Number(persisted.rows[0].calculated_fdr) === expectedFdr, 'column FDR should match');

    const listed = await request(
      baseUrl,
      'GET',
      `/setups?vehicleId=${vehicleAId}`,
      { token: tokenA },
    );
    assert(listed.status === 200, `list failed: ${listed.status}`);
    const summaries = listed.body.data as Array<{ id: string; title: string }>;
    assert(
      summaries.some((item) => item.id === setup.id && item.title === 'Rubicon Low-CoG'),
      'list should include the new setup summary',
    );

    const accountListed = await request(baseUrl, 'GET', '/setups', {
      token: tokenA,
    });
    assert(
      accountListed.status === 200,
      `account-wide list failed: ${accountListed.status}`,
    );
    assert(
      (accountListed.body.data as Array<{ id: string }>).some(
        (item) => item.id === setup.id,
      ),
      'account-wide list should include the new setup',
    );

    const publicAnon = await request(baseUrl, 'GET', `/setups/${setup.id}`);
    assert(publicAnon.status === 200, `public GET without JWT should 200, got ${publicAnon.status}`);
    assert(publicAnon.body.data.title === 'Rubicon Low-CoG', 'anonymous public read should return sheet');

    const foreignVehicle = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleBId,
        title: 'Stolen Clipboard',
        settings: buildSettings(),
      },
    });
    assert(
      foreignVehicle.status === 404,
      `create on foreign vehicle should 404, got ${foreignVehicle.status}`,
    );

    const foreignList = await request(
      baseUrl,
      'GET',
      `/setups?vehicleId=${vehicleBId}`,
      { token: tokenA },
    );
    assert(
      foreignList.status === 404,
      `list foreign vehicle should 404, got ${foreignList.status}`,
    );

    const portalExpected = calculateFdr({
      pinionTeeth: 15,
      spurTeeth: 54,
      transmissionInternalRatio: 3,
      portalGearsInstalled: true,
      portalBoxRatio: 2,
    });
    assert(portalExpected === 21.6, `portal FDR should be 21.6, got ${portalExpected}`);

    const portalCreated = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Portal Crawl Spec',
        settings: buildSettings({
          portalGearsInstalled: true,
          portalBoxRatio: 2,
        }),
      },
    });
    assert(portalCreated.status === 201, `portal create failed: ${portalCreated.status}`);
    assert(
      portalCreated.body.data.calculatedFdr === portalExpected,
      `portal FDR should be ${portalExpected}`,
    );

    const privateCreated = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Night Practice',
        isPublic: false,
        settings: buildSettings(),
      },
    });
    assert(privateCreated.status === 201, `private create failed: ${privateCreated.status}`);
    const privateId = privateCreated.body.data.id as string;

    const privateAnon = await request(baseUrl, 'GET', `/setups/${privateId}`);
    assert(
      privateAnon.status === 404,
      `anonymous private GET should 404, got ${privateAnon.status}`,
    );

    const privateForeign = await request(baseUrl, 'GET', `/setups/${privateId}`, {
      token: tokenB,
    });
    assert(
      privateForeign.status === 404,
      `foreign private GET should 404, got ${privateForeign.status}`,
    );

    const privateOwner = await request(baseUrl, 'GET', `/setups/${privateId}`, {
      token: tokenA,
    });
    assert(privateOwner.status === 200, 'owner can read a private sheet');
    assert(privateOwner.body.data.isPublic === false, 'detail should remain private');

    const invalidToken = await request(baseUrl, 'GET', `/setups/${setup.id}`, {
      token: 'not-a-real-jwt',
    });
    assert(
      invalidToken.status === 401,
      `invalid JWT on optional route should 401, got ${invalidToken.status}`,
    );

    const foreignPut = await request(baseUrl, 'PUT', `/setups/${setup.id}`, {
      token: tokenB,
      body: { title: 'Hijacked Spec' },
    });
    assert(foreignPut.status === 404, `foreign put should 404, got ${foreignPut.status}`);

    const updated = await request(baseUrl, 'PUT', `/setups/${setup.id}`, {
      token: tokenA,
      body: {
        title: 'Rubicon Low-CoG Rev 2',
        settings: buildSettings({ pinionTeeth: 18, spurTeeth: 54 }),
      },
    });
    assert(updated.status === 200, `update failed: ${updated.status}`);
    const revisedFdr = calculateFdr({
      pinionTeeth: 18,
      spurTeeth: 54,
      transmissionInternalRatio: 3,
    });
    assert(revisedFdr === 9, `revised FDR should be 9, got ${revisedFdr}`);
    assert(updated.body.data.title === 'Rubicon Low-CoG Rev 2', 'title should update');
    assert(
      updated.body.data.calculatedFdr === revisedFdr,
      `updated FDR should be ${revisedFdr}`,
    );

    const vehicleDetail = await request(baseUrl, 'GET', `/vehicles/${vehicleAId}`, {
      token: tokenA,
    });
    assert(vehicleDetail.body.data.setupCount === 3, 'vehicle detail setupCount should be 3');
    assert(
      (vehicleDetail.body.data.setups as Array<{ id: string }>).some(
        (item) => item.id === setup.id,
      ),
      'vehicle detail should include setup summaries',
    );

    const secondBay = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Second Bay',
        make: 'Axial',
        model: 'SCX10 III',
      },
    });
    assert(secondBay.status === 201, `second chassis failed: ${secondBay.status}`);
    const vehicleA2Id = secondBay.body.data.id as string;

    const secondBaySetup = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleA2Id,
        title: 'SCX Comp Spec',
        settings: buildSettings(),
      },
    });
    assert(
      secondBaySetup.status === 201,
      `second chassis setup failed: ${secondBaySetup.status}`,
    );
    const secondBaySetupId = secondBaySetup.body.data.id as string;

    const allGarageSheets = await request(baseUrl, 'GET', '/setups', {
      token: tokenA,
    });
    assert(
      allGarageSheets.status === 200,
      `all-garage list failed: ${allGarageSheets.status}`,
    );
    const allGarageIds = (allGarageSheets.body.data as Array<{ id: string; vehicleId: string }>).map(
      (item) => item.id,
    );
    assert(
      allGarageIds.includes(setup.id) && allGarageIds.includes(secondBaySetupId),
      'account-wide list should include sheets from every owned chassis',
    );

    const secondChassisOnly = await request(
      baseUrl,
      'GET',
      `/setups?vehicleId=${vehicleA2Id}`,
      { token: tokenA },
    );
    assert(
      secondChassisOnly.status === 200,
      `second chassis list failed: ${secondChassisOnly.status}`,
    );
    const secondChassisRows = secondChassisOnly.body.data as Array<{ id: string }>;
    assert(
      secondChassisRows.length === 1 && secondChassisRows[0]?.id === secondBaySetupId,
      'vehicle-scoped list must not mix chassis',
    );

    const reassigned = await request(baseUrl, 'PUT', `/setups/${setup.id}`, {
      token: tokenA,
      body: { vehicleId: vehicleA2Id },
    });
    assert(
      reassigned.status === 400,
      `moving a sheet to another chassis should 400, got ${reassigned.status}`,
    );
    const stillOnOriginalBay = await request(baseUrl, 'GET', `/setups/${setup.id}`, {
      token: tokenA,
    });
    assert(
      stillOnOriginalBay.body.data.vehicleId === vehicleAId,
      'update must not restamp a sheet onto a different chassis',
    );

    const foreignAccountList = await request(baseUrl, 'GET', '/setups', {
      token: tokenB,
    });
    assert(
      foreignAccountList.status === 200,
      `foreign account list failed: ${foreignAccountList.status}`,
    );
    assert(
      (foreignAccountList.body.data as Array<{ id: string }>).every(
        (item) => item.id !== setup.id && item.id !== secondBaySetupId,
      ),
      'account-wide list must not leak another driver sheets',
    );

    const deleted = await request(baseUrl, 'DELETE', `/setups/${privateId}`, {
      token: tokenA,
    });
    assert(deleted.status === 200, `delete failed: ${deleted.status}`);
    assert(deleted.body.data.deleted === true, 'delete payload should mark deleted');
    assert(deleted.body.data.id === privateId, 'delete payload should echo id');

    const gone = await database.query(`SELECT 1 FROM setups WHERE id = $1`, [
      privateId,
    ]);
    assert(gone.rowCount === 0, 'deleted setup should be removed from PostgreSQL');

    const deletedGet = await request(baseUrl, 'GET', `/setups/${privateId}`, {
      token: tokenA,
    });
    assert(deletedGet.status === 404, 'deleted setup should 404');

    const foreignDelete = await request(baseUrl, 'DELETE', `/setups/${setup.id}`, {
      token: tokenB,
    });
    assert(
      foreignDelete.status === 404,
      `foreign delete should 404, got ${foreignDelete.status}`,
    );

    console.log('setup logging e2e: all acceptance checks passed');
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
