/**
 * Purpose: exercise Milestone 20 in-app pit signals: like/fork/comment/report fan-out, skip-self, private denial, and mark-read.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AuthTokenResponse } from '../src/contracts/auth.contract';
import {
  PaginatedNotifications,
  UnreadCountResult,
} from '../src/contracts/notification.contract';
import { CreatedReport } from '../src/contracts/report.contract';
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

async function requestJson<T>(
  baseUrl: string,
  method: string,
  urlPath: string,
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

  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const body = (await response.json().catch(() => ({}))) as Envelope<T>;
  return { status: response.status, body };
}

function setupSettings() {
  return {
    drivetrain: {
      pinionTeeth: 14,
      spurTeeth: 56,
      transmissionInternalRatio: 3.0,
      gearPitch: '48P',
      batteryCellCount: 3,
    },
    suspension: {
      front: {
        oilViscosityValue: 30,
        oilViscosityUnit: 'WT' as const,
        springRateDescription: '1.4 lb/in',
        shockLengthEyeToEyeMm: 90,
        camberAngleDeg: -1,
        toeAngleDeg: 0,
        rideHeightMm: 28,
      },
      rear: {
        oilViscosityValue: 30,
        oilViscosityUnit: 'WT' as const,
        springRateDescription: '1.4 lb/in',
        shockLengthEyeToEyeMm: 90,
        camberAngleDeg: 0,
        toeAngleDeg: 0,
        rideHeightMm: 28,
      },
      portalGearsInstalled: false,
    },
    tiresAndWeight: {
      front: {
        brand: 'Pro-Line',
        model: 'Hyrax',
        compound: 'Predator',
        wheelDiameterInch: 1.9,
        insertType: 'dual_stage_foam' as const,
        brassWheelWeightGramsPerWheel: 0,
      },
      rear: {
        brand: 'Pro-Line',
        model: 'Hyrax',
        compound: 'Predator',
        wheelDiameterInch: 1.9,
        insertType: 'dual_stage_foam' as const,
        brassWheelWeightGramsPerWheel: 0,
      },
      weight: {
        totalRtrWeightGrams: 2500,
        frontAxleWeightGrams: 1500,
        rearAxleWeightGrams: 1000,
      },
    },
    trackConditions: {
      surface: 'slick_rock' as const,
      grip: 'high' as const,
      locationTag: 'Moab',
    },
    driverNotes: 'Public sheet for pit signals.',
  };
}

export async function runNotificationsVerification(
  baseUrl: string,
  database: DatabaseService,
): Promise<void> {
  const stamp = Date.now();
  const driverA = {
    email: `ntf.a.${stamp}@example.com`,
    password: 'password123',
    callsign: `ntf_a_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };
  const driverB = {
    email: `ntf.b.${stamp}@example.com`,
    password: 'password123',
    callsign: `ntf_b_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };
  const admin = {
    email: `ntf.adm.${stamp}@example.com`,
    password: 'password123',
    callsign: `ntf_adm_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };

  try {
    const aRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: driverA,
    });
    assert(aRes.status === 201, `A register failed: ${JSON.stringify(aRes.body)}`);
    const tokenA = aRes.body.data?.token as string;

    const bRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: driverB,
    });
    assert(bRes.status === 201, `B register failed: ${JSON.stringify(bRes.body)}`);
    const tokenB = bRes.body.data?.token as string;

    const adminRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: admin,
    });
    assert(adminRes.status === 201, `admin register failed: ${JSON.stringify(adminRes.body)}`);
    await database.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [
      adminRes.body.data?.user.id,
    ]);
    const tokenAdmin = adminRes.body.data?.token as string;

    const aVehicle = await requestJson<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Signal Rig',
        make: 'Element',
        model: 'Enduro',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(aVehicle.status === 201, 'A vehicle create failed');
    const aVehicleId = aVehicle.body.data?.id as string;

    const bVehicle = await requestJson<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: tokenB,
      body: {
        name: 'Fork Bay',
        make: 'Axial',
        model: 'SCX10 III',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(bVehicle.status === 201, 'B vehicle create failed');
    const bVehicleId = bVehicle.body.data?.id as string;

    const publicRes = await requestJson<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: aVehicleId,
        title: 'Public Signal Sheet',
        isPublic: true,
        settings: setupSettings(),
      },
    });
    assert(publicRes.status === 201, `public setup failed: ${JSON.stringify(publicRes.body)}`);
    const publicSetup = publicRes.body.data as SetupEntity;

    const privateRes = await requestJson<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: aVehicleId,
        title: 'Private Garage Tune',
        isPublic: false,
        settings: setupSettings(),
      },
    });
    assert(privateRes.status === 201, 'private setup failed');
    const privateSetup = privateRes.body.data as SetupEntity;

    const unauth = await requestJson(baseUrl, 'GET', '/notifications');
    assert(unauth.status === 401, `expected 401 without JWT, got ${unauth.status}`);

    const likeRes = await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/like`, {
      token: tokenB,
    });
    assert(likeRes.status === 201 || likeRes.status === 200, `like failed: ${JSON.stringify(likeRes.body)}`);

    const aAfterLike = await requestJson<PaginatedNotifications>(baseUrl, 'GET', '/notifications', {
      token: tokenA,
    });
    assert(aAfterLike.status === 200, `A list failed: ${JSON.stringify(aAfterLike.body)}`);
    const likeItem = (aAfterLike.body.data?.items ?? []).find((item) => item.type === 'like');
    assert(likeItem !== undefined, 'A should receive a like notification');
    assert(likeItem.actorCallsign === driverB.callsign, `like actor mismatch: ${likeItem.actorCallsign}`);
    assert(
      (aAfterLike.body.data?.unreadCount ?? 0) >= 1,
      `unreadCount should be >= 1, got ${aAfterLike.body.data?.unreadCount}`,
    );

    const bAfterLike = await requestJson<PaginatedNotifications>(baseUrl, 'GET', '/notifications', {
      token: tokenB,
    });
    assert(
      !(bAfterLike.body.data?.items ?? []).some((item) => item.id === likeItem.id),
      'B must not read A’s like notification',
    );

    const unlikeRes = await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/like`, {
      token: tokenB,
    });
    assert(unlikeRes.status === 201 || unlikeRes.status === 200, 'unlike failed');
    const aAfterUnlike = await requestJson<PaginatedNotifications>(baseUrl, 'GET', '/notifications', {
      token: tokenA,
    });
    const likeRows = (aAfterUnlike.body.data?.items ?? []).filter((item) => item.type === 'like');
    assert(likeRows.length === 1, `unlike must not insert or delete like rows, got ${likeRows.length}`);

    await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/like`, { token: tokenA });
    await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/comments`, {
      token: tokenA,
      body: { body: 'Author note on own sheet' },
    });
    const aAfterSelf = await requestJson<PaginatedNotifications>(baseUrl, 'GET', '/notifications', {
      token: tokenA,
    });
    assert(
      (aAfterSelf.body.data?.items ?? []).every((item) => item.actorCallsign !== driverA.callsign),
      'self like/comment must insert zero rows',
    );

    const forkRes = await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/fork`, {
      token: tokenB,
      body: { targetVehicleId: bVehicleId, title: 'B Moab Fork' },
    });
    assert(forkRes.status === 201, `fork failed: ${JSON.stringify(forkRes.body)}`);
    const aAfterFork = await requestJson<PaginatedNotifications>(baseUrl, 'GET', '/notifications', {
      token: tokenA,
    });
    const forkItem = (aAfterFork.body.data?.items ?? []).find((item) => item.type === 'fork');
    assert(forkItem !== undefined, 'A should receive a fork notification');
    assert(forkItem.actorCallsign === driverB.callsign, 'fork actor should be B');

    const longBody = 'x'.repeat(160);
    const commentRes = await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/comments`, {
      token: tokenB,
      body: { body: longBody },
    });
    assert(commentRes.status === 201, `comment failed: ${JSON.stringify(commentRes.body)}`);
    const aAfterComment = await requestJson<PaginatedNotifications>(baseUrl, 'GET', '/notifications', {
      token: tokenA,
    });
    const commentItem = (aAfterComment.body.data?.items ?? []).find((item) => item.type === 'comment');
    assert(commentItem !== undefined, 'A should receive a comment notification');
    assert(commentItem.bodyPreview === 'x'.repeat(140), `preview length ${commentItem.bodyPreview?.length}`);

    const aPrivateLike = await requestJson(baseUrl, 'POST', `/setups/${privateSetup.id}/like`, {
      token: tokenA,
    });
    assert(
      aPrivateLike.status === 201 || aPrivateLike.status === 200,
      `owner like private failed: ${JSON.stringify(aPrivateLike.body)}`,
    );
    const bPrivateLike = await requestJson(baseUrl, 'POST', `/setups/${privateSetup.id}/like`, {
      token: tokenB,
    });
    assert(bPrivateLike.status === 404, `foreign private like should 404, got ${bPrivateLike.status}`);
    const aAfterPrivate = await requestJson<PaginatedNotifications>(baseUrl, 'GET', '/notifications', {
      token: tokenA,
    });
    assert(
      !(aAfterPrivate.body.data?.items ?? []).some((item) => item.setupId === privateSetup.id),
      'private sheet activity must never fan out',
    );

    const reportRes = await requestJson<CreatedReport>(baseUrl, 'POST', '/reports', {
      token: tokenB,
      body: {
        targetType: 'setup',
        targetId: publicSetup.id,
        reasonCode: 'spam',
      },
    });
    assert(reportRes.status === 201, `report failed: ${JSON.stringify(reportRes.body)}`);
    const dismissRes = await requestJson(baseUrl, 'PATCH', `/admin/reports/${reportRes.body.data?.id}`, {
      token: tokenAdmin,
      body: { status: 'dismissed', reason: 'No pit-lane violation' },
    });
    assert(dismissRes.status === 200, `dismiss failed: ${JSON.stringify(dismissRes.body)}`);
    const bAfterReport = await requestJson<PaginatedNotifications>(baseUrl, 'GET', '/notifications', {
      token: tokenB,
    });
    const outcome = (bAfterReport.body.data?.items ?? []).find((item) => item.type === 'report_outcome');
    assert(outcome !== undefined, 'B should receive report_outcome');
    assert(outcome.bodyPreview === 'dismissed', `outcome preview ${outcome.bodyPreview}`);

    const markAll = await requestJson<UnreadCountResult>(baseUrl, 'POST', '/notifications/read', {
      token: tokenA,
      body: {},
    });
    assert(markAll.status === 200, `mark all failed: ${JSON.stringify(markAll.body)}`);
    assert(markAll.body.data?.unreadCount === 0, `unreadCount should be 0, got ${markAll.body.data?.unreadCount}`);
    const unread = await requestJson<UnreadCountResult>(baseUrl, 'GET', '/notifications/unread-count', {
      token: tokenA,
    });
    assert(unread.body.data?.unreadCount === 0, 'unread-count poll should be 0 after mark all');
  } finally {
    await database.query('DELETE FROM users WHERE email = ANY($1)', [
      [driverA.email, driverB.email, admin.email],
    ]);
  }
}

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone20-e2e-secret';
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
    await runNotificationsVerification(baseUrl, database);
    console.log('[Notifications] like/fork/comment/report fan-out and mark-read passed');
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
