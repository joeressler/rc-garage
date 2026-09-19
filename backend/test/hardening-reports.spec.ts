/**
 * Purpose: exercise Milestone 16 Helmet/throttler envelope, recaptcha/legal register, and content-report queue.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AdminOverview, AdminReportSummary, PaginatedAdminReports, PaginatedAuditLog } from '../src/contracts/admin.contract';
import { AuthTokenResponse } from '../src/contracts/auth.contract';
import { PaginatedFeedResponse } from '../src/contracts/feed.contract';
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
    driverNotes: 'Public sheet for report tests.',
  };
}

export async function runContentReportsVerification(
  baseUrl: string,
  database: DatabaseService,
): Promise<void> {
  const stamp = Date.now();
  const reporter = {
    email: `rpt.rep.${stamp}@example.com`,
    password: 'password123',
    callsign: `rpt_rep_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };
  const author = {
    email: `rpt.auth.${stamp}@example.com`,
    password: 'password123',
    callsign: `rpt_auth_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };
  const admin = {
    email: `rpt.adm.${stamp}@example.com`,
    password: 'password123',
    callsign: `rpt_adm_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };
  const moderator = {
    email: `rpt.mod.${stamp}@example.com`,
    password: 'password123',
    callsign: `rpt_mod_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };

  try {
    const reporterRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: reporter,
    });
    assert(reporterRes.status === 201, `reporter register failed: ${JSON.stringify(reporterRes.body)}`);
    const reporterToken = reporterRes.body.data?.token as string;

    const authorRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: author,
    });
    assert(authorRes.status === 201, `author register failed: ${JSON.stringify(authorRes.body)}`);
    const authorToken = authorRes.body.data?.token as string;

    const adminRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: admin,
    });
    assert(adminRes.status === 201, `admin register failed: ${JSON.stringify(adminRes.body)}`);
    await database.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [
      adminRes.body.data?.user.id,
    ]);
    const adminToken = adminRes.body.data?.token as string;

    const modRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: moderator,
    });
    assert(modRes.status === 201, `moderator register failed: ${JSON.stringify(modRes.body)}`);
    await requestJson(baseUrl, 'PATCH', `/admin/users/${modRes.body.data?.user.id}/role`, {
      token: adminToken,
      body: { role: 'moderator', reason: 'Appoint report marshall' },
    });
    const modLogin = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/login', {
      body: { email: moderator.email, password: moderator.password },
    });
    const modToken = modLogin.body.data?.token as string;

    const vehicleRes = await requestJson<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: authorToken,
      body: {
        name: 'Report Rig',
        make: 'Element',
        model: 'Enduro',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(vehicleRes.status === 201, 'vehicle create failed');

    const setupRes = await requestJson<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: authorToken,
      body: {
        vehicleId: vehicleRes.body.data?.id,
        title: 'Reportable Public Sheet',
        isPublic: true,
        settings: setupSettings(),
      },
    });
    assert(setupRes.status === 201, `setup create failed: ${JSON.stringify(setupRes.body)}`);
    const setup = setupRes.body.data as SetupEntity;

    const firstReport = await requestJson<CreatedReport>(baseUrl, 'POST', '/reports', {
      token: reporterToken,
      body: {
        targetType: 'setup',
        targetId: setup.id,
        reasonCode: 'spam',
      },
    });
    assert(firstReport.status === 201, `report create failed: ${JSON.stringify(firstReport.body)}`);
    assert(firstReport.body.data?.status === 'open', 'created report must be open');

    const duplicate = await requestJson(baseUrl, 'POST', '/reports', {
      token: reporterToken,
      body: {
        targetType: 'setup',
        targetId: setup.id,
        reasonCode: 'abuse',
      },
    });
    assert(duplicate.status === 409, `duplicate open report should 409, got ${duplicate.status}`);

    const driverQueue = await requestJson(baseUrl, 'GET', '/admin/reports', {
      token: reporterToken,
    });
    assert(driverQueue.status === 403, `driver listing reports must 403, got ${driverQueue.status}`);

    const overviewBefore = await requestJson<AdminOverview>(baseUrl, 'GET', '/admin/overview', {
      token: modToken,
    });
    assert(
      (overviewBefore.body.data?.openReportCount ?? 0) >= 1,
      'openReportCount should include the new report',
    );

    const queue = await requestJson<PaginatedAdminReports>(baseUrl, 'GET', '/admin/reports', {
      token: modToken,
    });
    assert(queue.status === 200, `queue list failed: ${JSON.stringify(queue.body)}`);
    const openRow = queue.body.data?.items.find((item) => item.id === firstReport.body.data?.id);
    assert(openRow !== undefined, 'open report must appear in moderator queue');

    const resolveRes = await requestJson<AdminReportSummary>(
      baseUrl,
      'PATCH',
      `/admin/reports/${firstReport.body.data?.id}`,
      {
        token: modToken,
        body: {
          status: 'actioned',
          reason: 'Spam sheet hidden via report',
          hideSetup: true,
        },
      },
    );
    assert(resolveRes.status === 200, `resolve failed: ${JSON.stringify(resolveRes.body)}`);
    assert(resolveRes.body.data?.status === 'actioned', 'report should be actioned');

    const feedAfter = await requestJson<PaginatedFeedResponse>(baseUrl, 'GET', '/feed');
    assert(
      !(feedAfter.body.data?.items ?? []).some((item) => item.id === setup.id),
      'hidden reported setup must leave the feed',
    );

    const qrAfter = await requestJson(baseUrl, 'GET', `/qr/resolve/${setup.qrSlug}`);
    assert(qrAfter.status === 404, `hidden QR must 404, got ${qrAfter.status}`);

    const overviewAfter = await requestJson<AdminOverview>(baseUrl, 'GET', '/admin/overview', {
      token: modToken,
    });
    assert(
      (overviewAfter.body.data?.openReportCount ?? 1) <
        (overviewBefore.body.data?.openReportCount ?? 0),
      'openReportCount must drop after action',
    );

    const audit = await requestJson<PaginatedAuditLog>(baseUrl, 'GET', '/admin/audit-log', {
      token: modToken,
    });
    const actions = (audit.body.data?.items ?? []).map((item) => item.action);
    assert(actions.includes('setup.hide'), 'audit must include setup.hide');
    assert(actions.includes('report.resolve'), 'audit must include report.resolve');
  } finally {
    await database.query('DELETE FROM users WHERE email = ANY($1)', [
      [reporter.email, author.email, admin.email, moderator.email],
    ]);
  }
}

export async function runHardeningReportsVerification(
  baseUrl: string,
  database: DatabaseService,
): Promise<void> {
  const stamp = Date.now();
  console.log(`[Hardening] Milestone 16 verification (stamp: ${stamp})`);

  process.env.THROTTLE_DISABLED = 'false';
  let lastStatus = 0;
  let lastError = '';
  for (let i = 0; i < 6; i += 1) {
    const loginRes = await requestJson(baseUrl, 'POST', '/auth/login', {
      body: { email: `throttle.${stamp}@example.com`, password: 'password123' },
    });
    lastStatus = loginRes.status;
    lastError = loginRes.body.error ?? '';
  }
  assert(lastStatus === 429, `auth bucket should 429 on 6th login, got ${lastStatus}`);
  assert(lastError === 'Too Many Requests', `429 envelope error mismatch: ${lastError}`);
  process.env.THROTTLE_DISABLED = 'true';

  const missingToken = await requestJson(baseUrl, 'POST', '/auth/register', {
    body: {
      email: `hard.notoken.${stamp}@example.com`,
      password: 'password123',
      callsign: `hard_nt_${stamp}`.slice(0, 30),
      ageAttested: true,
      acceptedLegal: true,
    },
  });
  assert(missingToken.status === 400, `missing recaptchaToken should 400, got ${missingToken.status}`);

  const missingLegal = await requestJson(baseUrl, 'POST', '/auth/register', {
    body: {
      email: `hard.nolegal.${stamp}@example.com`,
      password: 'password123',
      callsign: `hard_nl_${stamp}`.slice(0, 30),
      ageAttested: true,
      recaptchaToken: 'dev-bypass',
    },
  });
  assert(missingLegal.status === 400, `missing acceptedLegal should 400, got ${missingLegal.status}`);
  assert(
    (missingLegal.body.message ?? []).some((item) => item.includes('acceptedLegal')),
    `acceptedLegal error missing: ${JSON.stringify(missingLegal.body)}`,
  );

  const bypassOk = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
    body: {
      email: `hard.ok.${stamp}@example.com`,
      password: 'password123',
      callsign: `hard_ok_${stamp}`.slice(0, 30),
      ageAttested: true,
      acceptedLegal: true,
      recaptchaToken: 'dev-bypass',
    },
  });
  assert(bypassOk.status === 201, `dev-bypass register failed: ${JSON.stringify(bypassOk.body)}`);

  const victim = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
    body: {
      email: `hard.sus.${stamp}@example.com`,
      password: 'password123',
      callsign: `hard_sus_${stamp}`.slice(0, 30),
      ageAttested: true,
      acceptedLegal: true,
      recaptchaToken: 'dev-bypass',
    },
  });
  const adminEmail = `hard.adm.${stamp}@example.com`;
  const admin = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
    body: {
      email: adminEmail,
      password: 'password123',
      callsign: `hard_adm_${stamp}`.slice(0, 30),
      ageAttested: true,
      acceptedLegal: true,
      recaptchaToken: 'dev-bypass',
    },
  });
  await database.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [
    admin.body.data?.user.id,
  ]);
  await requestJson(baseUrl, 'PATCH', `/admin/users/${victim.body.data?.user.id}/suspension`, {
    token: admin.body.data?.token,
    body: { suspend: true, reason: 'Suspended for report gate test' },
  });
  const suspendedReport = await requestJson(baseUrl, 'POST', '/reports', {
    token: victim.body.data?.token,
    body: {
      targetType: 'user',
      targetId: admin.body.data?.user.id,
      reasonCode: 'abuse',
    },
  });
  assert(
    suspendedReport.status === 403,
    `suspended JWT POST /reports should 403, got ${suspendedReport.status}`,
  );

  await database.query('DELETE FROM users WHERE email = ANY($1)', [
    [
      `hard.ok.${stamp}@example.com`,
      `hard.sus.${stamp}@example.com`,
      adminEmail,
    ],
  ]);

  await runContentReportsVerification(baseUrl, database);
  console.log('[Hardening] Milestone 16 acceptance checks passed');
}

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  process.env.THROTTLE_DISABLED = 'false';
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
    await runHardeningReportsVerification(baseUrl, database);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
