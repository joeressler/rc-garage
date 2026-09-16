/**
 * Purpose: exercise Milestone 6 fork lineage, authorization, atomic fork_count, and immutability.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { DatabaseService } from '../src/database/database.service';
import { SetupEntity, SetupSettings } from '../src/contracts/setup.contract';
import { calculateFdr } from '../src/modules/setups/utils/telemetry-math.util';

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

function shockSpec(overrides: { oilViscosityValue?: number; oilViscosityUnit?: 'WT' | 'CST' } = {}) {
  return {
    oilViscosityValue: overrides.oilViscosityValue ?? 30,
    oilViscosityUnit: overrides.oilViscosityUnit ?? ('WT' as const),
    springRateDescription: '3.2 lb/in',
    shockLengthEyeToEyeMm: 90,
    rideHeightMm: 28,
  };
}

function axleTires(compound = 'Alien') {
  return {
    brand: 'Pit Bull',
    model: 'Predator',
    compound,
  };
}

function buildSettings(overrides: { pinionTeeth?: number; spurTeeth?: number } = {}) {
  return {
    drivetrain: {
      pinionTeeth: overrides.pinionTeeth ?? 14,
      spurTeeth: overrides.spurTeeth ?? 56,
      transmissionInternalRatio: 3,
    },
    suspension: {
      front: shockSpec(),
      rear: shockSpec(),
      portalGearsInstalled: false,
    },
    tiresAndWeight: {
      front: axleTires(),
      rear: axleTires(),
      weight: {
        totalRtrWeightGrams: 2500,
        frontAxleWeightGrams: 1480,
        rearAxleWeightGrams: 1020,
      },
    },
    trackConditions: {
      surface: 'slick_rock',
      grip: 'high',
      locationTag: 'Moab Slickrock',
    },
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone6-e2e-secret';
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
    email: `fork.a.${stamp}@example.com`,
    password: 'pit-mat-pass-1',
    callsign: `fork_a_${stamp}`.slice(0, 30),
  };
  const userB = {
    email: `fork.b.${stamp}@example.com`,
    password: 'pit-mat-pass-2',
    callsign: `fork_b_${stamp}`.slice(0, 30),
  };

  try {
    await database.migrateUp();

    const registerA = await request(baseUrl, 'POST', '/auth/register', { body: userA });
    assert(registerA.status === 201, `register A failed: ${registerA.status}`);
    const tokenA = registerA.body.data.token as string;

    const registerB = await request(baseUrl, 'POST', '/auth/register', { body: userB });
    assert(registerB.status === 201, `register B failed: ${registerB.status}`);
    const tokenB = registerB.body.data.token as string;

    const vehicleA = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: { name: 'Enduro Sendero', make: 'Element', model: 'Enduro Sendero HD' },
    });
    assert(vehicleA.status === 201, `create vehicle A failed: ${vehicleA.status}`);
    const vehicleAId = vehicleA.body.data.id as string;

    const vehicleB = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenB,
      body: { name: 'SCX10 III', make: 'Axial', model: 'SCX10 III' },
    });
    assert(vehicleB.status === 201, `create vehicle B failed: ${vehicleB.status}`);
    const vehicleBId = vehicleB.body.data.id as string;

    const vehicleB2 = await request(baseUrl, 'POST', '/vehicles', {
      token: tokenB,
      body: { name: 'Capra', make: 'Axial', model: 'Capra' },
    });
    const vehicleB2Id = vehicleB2.body.data.id as string;

    const publicCreated = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Moab Slickrock Spec',
        description: 'Baseline granite crawl',
        tags: ['moab', 'slickrock'],
        settings: buildSettings({ pinionTeeth: 14, spurTeeth: 56 }),
      },
    });
    assert(publicCreated.status === 201, `create public setup failed: ${publicCreated.status}`);
    const parent = publicCreated.body.data as SetupEntity;
    assert(parent.forkCount === 0, 'new public sheet starts with forkCount 0');
    const parentFdr = calculateFdr({
      pinionTeeth: 14,
      spurTeeth: 56,
      transmissionInternalRatio: 3,
    });
    assert(parent.calculatedFdr === parentFdr, `parent FDR should be ${parentFdr}`);

    const privateCreated = await request(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Night Practice',
        isPublic: false,
        settings: buildSettings(),
      },
    });
    const privateId = privateCreated.body.data.id as string;

    const unauthFork = await request(baseUrl, 'POST', `/setups/${parent.id}/fork`, {
      body: { targetVehicleId: vehicleBId },
    });
    assert(unauthFork.status === 401, `unauthenticated fork should 401, got ${unauthFork.status}`);

    const privateFork = await request(baseUrl, 'POST', `/setups/${privateId}/fork`, {
      token: tokenB,
      body: { targetVehicleId: vehicleBId },
    });
    assert(
      privateFork.status === 404,
      `forking someone else's private setup should 404, got ${privateFork.status}`,
    );

    const missingFork = await request(
      baseUrl,
      'POST',
      '/setups/00000000-0000-4000-8000-000000000099/fork',
      { token: tokenB, body: { targetVehicleId: vehicleBId } },
    );
    assert(missingFork.status === 404, `missing source should 404, got ${missingFork.status}`);

    const foreignVehicle = await request(baseUrl, 'POST', `/setups/${parent.id}/fork`, {
      token: tokenB,
      body: { targetVehicleId: vehicleAId },
    });
    assert(
      foreignVehicle.status === 403,
      `fork into another user's vehicle should 403, got ${foreignVehicle.status}`,
    );

    const invalidOverride = await request(baseUrl, 'POST', `/setups/${parent.id}/fork`, {
      token: tokenB,
      body: {
        targetVehicleId: vehicleBId,
        settingOverrides: { drivetrain: { pinionTeeth: 60 } },
      },
    });
    assert(
      invalidOverride.status === 400,
      `pinion overriding past spur should 400, got ${invalidOverride.status}`,
    );

    const forked = await request(baseUrl, 'POST', `/setups/${parent.id}/fork`, {
      token: tokenB,
      body: {
        targetVehicleId: vehicleBId,
        settingOverrides: {
          drivetrain: { pinionTeeth: 12 },
          suspension: { front: { oilViscosityValue: 31.5 } },
        },
      },
    });
    assert(forked.status === 201, `fork failed: ${forked.status}`);
    assert(forked.body.success === true, 'fork envelope should succeed');
    const child = forked.body.data as SetupEntity;
    assert(child.userId !== parent.userId, 'fork should belong to the caller');
    assert(child.vehicleId === vehicleBId, 'fork should land on the target vehicle');
    assert(child.title === 'Fork of Moab Slickrock Spec', 'default fork title');
    assert(child.isPublic === false, 'garage clone should start private');
    assert(child.forkedFromSetupId === parent.id, 'immediate parent pointer');
    assert(child.rootAncestorSetupId === parent.id, 'root ancestor should be the progenitor');
    assert(child.settings.drivetrain.pinionTeeth === 12, 'override pinion should apply');
    const childFdr = calculateFdr({
      pinionTeeth: 12,
      spurTeeth: 56,
      transmissionInternalRatio: 3,
    });
    assert(child.calculatedFdr === childFdr, `fork FDR should be ${childFdr} after pinion override`);
    assert(
      child.settings.suspension.front.oilViscosityValue === 31.5,
      'sparse viscosity override should merge',
    );
    assert(
      child.settings.suspension.rear.oilViscosityValue === 30,
      'unrelated rear viscosity should remain from parent',
    );
    assert(child.qrSlug !== parent.qrSlug, 'fork must receive a distinct qr_slug');
    assert(child.tags.includes('moab'), 'tags should copy from the ancestor');

    const parentAfter = await request(baseUrl, 'GET', `/setups/${parent.id}`, { token: tokenA });
    assert(parentAfter.status === 200, 'parent GET should succeed');
    const parentReloaded = parentAfter.body.data as SetupEntity;
    assert(parentReloaded.forkCount === 1, 'source fork_count should increment by 1');
    assert(
      parentReloaded.settings.drivetrain.pinionTeeth === 14,
      'parent pinion must remain 14 after fork overrides',
    );
    assert(parentReloaded.calculatedFdr === parentFdr, 'parent FDR must remain unchanged');

    const grandchild = await request(baseUrl, 'POST', `/setups/${child.id}/fork`, {
      token: tokenB,
      body: { targetVehicleId: vehicleB2Id, title: 'Moab Fork Rev 2' },
    });
    assert(grandchild.status === 201, `second-generation fork failed: ${grandchild.status}`);
    const grand = grandchild.body.data as SetupEntity;
    assert(grand.title === 'Moab Fork Rev 2', 'custom fork title should apply');
    assert(grand.forkedFromSetupId === child.id, 'grandchild immediate parent is the first fork');
    assert(
      grand.rootAncestorSetupId === parent.id,
      'grandchild root ancestor stays the original progenitor',
    );

    const mutatedSettings = {
      ...child.settings,
      drivetrain: {
        ...child.settings.drivetrain,
        pinionTeeth: 11,
      },
    } as SetupSettings;

    const mutated = await request(baseUrl, 'PUT', `/setups/${child.id}`, {
      token: tokenB,
      body: { settings: mutatedSettings },
    });
    assert(mutated.status === 200, `fork update failed: ${mutated.status}`);
    assert(
      mutated.body.data.settings.drivetrain.pinionTeeth === 11,
      'fork PUT should update the clone',
    );

    const parentAfterMutation = await request(baseUrl, 'GET', `/setups/${parent.id}`, {
      token: tokenA,
    });
    const parentFinal = parentAfterMutation.body.data as SetupEntity;
    assert(
      parentFinal.settings.drivetrain.pinionTeeth === 14,
      'updating the fork must never mutate the ancestor pinion',
    );
    assert(
      parentFinal.calculatedFdr === parentFdr,
      'updating the fork must never mutate ancestor FDR',
    );
    assert(parentFinal.forkCount === 1, 'ancestor fork_count stays 1 after clone edits');

    const ownerPrivateFork = await request(baseUrl, 'POST', `/setups/${privateId}/fork`, {
      token: tokenA,
      body: { targetVehicleId: vehicleAId },
    });
    assert(
      ownerPrivateFork.status === 201,
      `owner should fork their own private sheet, got ${ownerPrivateFork.status}`,
    );

    console.log('fork lineage e2e: all acceptance checks passed');
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
