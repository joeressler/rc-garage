/**
 * Purpose: exercise public driver garage listing, hidden/private exclusion, and suspended 404.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AuthTokenResponse } from '../src/contracts/auth.contract';
import { PublicDriverProfile } from '../src/contracts/profile.contract';
import { SetupEntity } from '../src/contracts/setup.contract';
import { VehicleEntity } from '../src/contracts/vehicle.contract';
import { DatabaseService } from '../src/database/database.service';
import { applyE2eHardeningEnv } from './e2e-env';

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

function buildSettings(locationTag: string) {
  return {
    drivetrain: {
      pinionTeeth: 15,
      spurTeeth: 54,
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
      surface: 'granite_rock',
      grip: 'high',
      locationTag,
    },
  };
}

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone17-e2e-secret';
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

  const owner = {
    email: `profile.a.${stamp}@example.com`,
    password: 'pit-mat-pass-1',
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
    callsign: `ProfA_${stamp}`.slice(0, 30),
  };
  const other = {
    email: `profile.b.${stamp}@example.com`,
    password: 'pit-mat-pass-2',
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
    callsign: `ProfB_${stamp}`.slice(0, 30),
  };
  const banned = {
    email: `profile.c.${stamp}@example.com`,
    password: 'pit-mat-pass-3',
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
    callsign: `ProfC_${stamp}`.slice(0, 30),
  };

  try {
    await database.migrateUp();

    const registerOwner = await request<AuthTokenResponse>(
      baseUrl,
      'POST',
      '/auth/register',
      { body: owner },
    );
    assert(registerOwner.status === 201, `register owner failed: ${registerOwner.status}`);
    const ownerToken = registerOwner.body.data?.token;
    assert(ownerToken, 'owner token missing');

    const registerOther = await request<AuthTokenResponse>(
      baseUrl,
      'POST',
      '/auth/register',
      { body: other },
    );
    assert(registerOther.status === 201, `register other failed: ${registerOther.status}`);
    const otherToken = registerOther.body.data?.token;
    assert(otherToken, 'other token missing');

    const registerBanned = await request<AuthTokenResponse>(
      baseUrl,
      'POST',
      '/auth/register',
      { body: banned },
    );
    assert(registerBanned.status === 201, `register banned failed: ${registerBanned.status}`);
    const bannedToken = registerBanned.body.data?.token;
    assert(bannedToken, 'banned token missing');

    const profilePatch = await request(baseUrl, 'PATCH', '/auth/profile', {
      token: ownerToken,
      body: {
        bio: 'Moab specialist',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    assert(profilePatch.status === 200, `profile patch failed: ${profilePatch.status}`);

    const ownerVehicle = await request<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: ownerToken,
      body: {
        name: 'Phoenix Trail Rig',
        make: 'Vanquish',
        model: `Phoenix${stamp}`.slice(0, 50),
        vehicleClass: 'crawler_scale',
      },
    });
    assert(ownerVehicle.status === 201, `owner vehicle failed: ${ownerVehicle.status}`);
    const ownerVehicleId = ownerVehicle.body.data?.id;
    assert(ownerVehicleId, 'owner vehicle id missing');

    const otherVehicle = await request<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: otherToken,
      body: {
        name: 'Other Trail Rig',
        make: 'Axial',
        model: `Capra${stamp}`.slice(0, 50),
        vehicleClass: 'crawler_scale',
      },
    });
    assert(otherVehicle.status === 201, `other vehicle failed: ${otherVehicle.status}`);
    const otherVehicleId = otherVehicle.body.data?.id;
    assert(otherVehicleId, 'other vehicle id missing');

    const bannedVehicle = await request<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: bannedToken,
      body: {
        name: 'Banned Trail Rig',
        make: 'Axial',
        model: `Banned${stamp}`.slice(0, 50),
        vehicleClass: 'crawler_scale',
      },
    });
    assert(bannedVehicle.status === 201, `banned vehicle failed: ${bannedVehicle.status}`);
    const bannedVehicleId = bannedVehicle.body.data?.id;
    assert(bannedVehicleId, 'banned vehicle id missing');

    const publicOlder = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: ownerToken,
      body: {
        vehicleId: ownerVehicleId,
        title: 'Older Public Spec',
        tags: ['moab', 'comp'],
        settings: buildSettings('Moab Rim'),
      },
    });
    assert(publicOlder.status === 201, `older public setup failed: ${publicOlder.status}`);
    const publicOlderId = publicOlder.body.data?.id;
    assert(publicOlderId, 'older public id missing');

    const publicNewer = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: ownerToken,
      body: {
        vehicleId: ownerVehicleId,
        title: 'Newer Public Spec',
        tags: ['comp'],
        settings: buildSettings('Moab Rim'),
      },
    });
    assert(publicNewer.status === 201, `newer public setup failed: ${publicNewer.status}`);
    const publicNewerId = publicNewer.body.data?.id;
    assert(publicNewerId, 'newer public id missing');

    await database.query(`UPDATE setups SET created_at = $1 WHERE id = $2`, [
      new Date(Date.now() - 60_000).toISOString(),
      publicOlderId,
    ]);

    const privateSetup = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: ownerToken,
      body: {
        vehicleId: ownerVehicleId,
        title: 'Night Practice',
        isPublic: false,
        settings: buildSettings('Private Pit'),
      },
    });
    assert(privateSetup.status === 201, `private setup failed: ${privateSetup.status}`);
    const privateId = privateSetup.body.data?.id;
    assert(privateId, 'private setup id missing');

    const hiddenSetup = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: ownerToken,
      body: {
        vehicleId: ownerVehicleId,
        title: 'Hidden Comp Spec',
        tags: ['hidden'],
        settings: buildSettings('Moab Rim'),
      },
    });
    assert(hiddenSetup.status === 201, `hidden setup failed: ${hiddenSetup.status}`);
    const hiddenId = hiddenSetup.body.data?.id;
    assert(hiddenId, 'hidden setup id missing');
    await database.query(`UPDATE setups SET is_hidden = TRUE WHERE id = $1`, [hiddenId]);

    const otherPublic = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: otherToken,
      body: {
        vehicleId: otherVehicleId,
        title: 'Other Driver Spec',
        settings: buildSettings('Slickrock'),
      },
    });
    assert(otherPublic.status === 201, `other public setup failed: ${otherPublic.status}`);
    const otherPublicId = otherPublic.body.data?.id;
    assert(otherPublicId, 'other public id missing');

    const bannedPublic = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: bannedToken,
      body: {
        vehicleId: bannedVehicleId,
        title: 'Banned Driver Spec',
        settings: buildSettings('Moab Rim'),
      },
    });
    assert(bannedPublic.status === 201, `banned public setup failed: ${bannedPublic.status}`);

    await database.query(`UPDATE users SET is_suspended = TRUE WHERE email = $1`, [
      banned.email,
    ]);

    const unknown = await request<PublicDriverProfile>(
      baseUrl,
      'GET',
      '/profiles/UnknownCallsign',
    );
    assert(unknown.status === 404, `unknown callsign should 404, got ${unknown.status}`);

    const suspended = await request<PublicDriverProfile>(
      baseUrl,
      'GET',
      `/profiles/${banned.callsign}`,
    );
    assert(suspended.status === 404, `suspended callsign should 404, got ${suspended.status}`);
    assert(
      suspended.body.error === unknown.body.error,
      'suspended lookup must not confirm a banned handle',
    );

    const mixedCase = await request<PublicDriverProfile>(
      baseUrl,
      'GET',
      `/profiles/${owner.callsign.toLowerCase()}`,
    );
    assert(mixedCase.status === 200, `case-insensitive profile failed: ${mixedCase.status}`);
    const profile = mixedCase.body.data;
    assert(profile, 'profile payload missing');
    assert(
      profile.callsign === owner.callsign,
      `canonical callsign should be ${owner.callsign}, got ${profile.callsign}`,
    );
    assert(profile.bio === 'Moab specialist', 'profile bio should pass through');
    assert(
      profile.avatarUrl === 'https://example.com/avatar.png',
      'profile avatarUrl should pass through',
    );
    assert(profile.publicSetupCount === 2, `publicSetupCount should be 2, got ${profile.publicSetupCount}`);
    const ids = profile.items.map((item) => item.id);
    assert(ids.length === 2, `expected 2 public sheets, got ${ids.length}`);
    assert(ids[0] === publicNewerId, 'newest public sheet should lead');
    assert(ids[1] === publicOlderId, 'older public sheet should follow');
    assert(!ids.includes(privateId), 'private sheets must never appear on the public garage');
    assert(!ids.includes(hiddenId), 'hidden sheets must never appear on the public garage');
    assert(!ids.includes(otherPublicId), 'other drivers sheets must not appear on this garage');
    assert(
      profile.items.every((item) => item.author.callsign === owner.callsign),
      'listed sheets must belong to the profile driver',
    );
    assert(
      profile.items[1]?.tags.includes('moab'),
      'feed items on the profile should include persisted tags',
    );

    const ownerAuthed = await request<PublicDriverProfile>(
      baseUrl,
      'GET',
      `/profiles/${owner.callsign}`,
      { token: ownerToken },
    );
    const ownerIds = (ownerAuthed.body.data?.items ?? []).map((item) => item.id);
    assert(!ownerIds.includes(privateId), 'owner JWT must not leak private sheets on the public garage');
    assert(ownerAuthed.body.data?.publicSetupCount === 2, 'owner JWT must not inflate publicSetupCount');

    const pageOne = await request<PublicDriverProfile>(
      baseUrl,
      'GET',
      `/profiles/${owner.callsign}?limit=1`,
    );
    assert(pageOne.body.data?.items.length === 1, 'limit=1 should return one sheet');
    assert(pageOne.body.data?.hasMore === true, 'limit=1 of two sheets should hasMore');
    assert(
      pageOne.body.data?.items[0]?.id === publicNewerId,
      'first page should be the newest public sheet',
    );
    const cursor = pageOne.body.data?.nextCursor;
    assert(cursor === publicNewerId, 'nextCursor should be the last item on the page');

    const pageTwo = await request<PublicDriverProfile>(
      baseUrl,
      'GET',
      `/profiles/${owner.callsign}?limit=1&cursor=${cursor}`,
    );
    assert(pageTwo.body.data?.items[0]?.id === publicOlderId, 'keyset should advance to the older sheet');
    assert(pageTwo.body.data?.hasMore === false, 'final profile page should not hasMore');
    assert(pageTwo.body.data?.publicSetupCount === 2, 'pagination must not change publicSetupCount');

    console.log('driver profiles e2e: all acceptance checks passed');
  } finally {
    await database.query('DELETE FROM users WHERE email = ANY($1)', [
      [owner.email, other.email, banned.email],
    ]);
    await app.close();
  }
}

async function request<T>(
  baseUrl: string,
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Envelope<T> }> {
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

  const body = (await response.json()) as Envelope<T>;
  return { status: response.status, body };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
