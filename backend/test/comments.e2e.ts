/**
 * Purpose: exercise Milestone 19 public Pit Notes: auth gates, private/hidden denial, rate limit, author delete, and moderator hide.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import {
  AdminCommentSummary,
  AdminReportSummary,
  PaginatedAdminReports,
  PaginatedAuditLog,
} from '../src/contracts/admin.contract';
import { AuthTokenResponse } from '../src/contracts/auth.contract';
import {
  DeleteCommentResult,
  PaginatedComments,
  SetupComment,
} from '../src/contracts/comment.contract';
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
    driverNotes: 'Public sheet for pit notes.',
  };
}

export async function runSetupCommentsVerification(
  baseUrl: string,
  database: DatabaseService,
): Promise<void> {
  const stamp = Date.now();
  const author = {
    email: `cmt.auth.${stamp}@example.com`,
    password: 'password123',
    callsign: `cmt_auth_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };
  const peer = {
    email: `cmt.peer.${stamp}@example.com`,
    password: 'password123',
    callsign: `cmt_peer_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };
  const admin = {
    email: `cmt.adm.${stamp}@example.com`,
    password: 'password123',
    callsign: `cmt_adm_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };
  const moderator = {
    email: `cmt.mod.${stamp}@example.com`,
    password: 'password123',
    callsign: `cmt_mod_${stamp}`.slice(0, 30),
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
  };

  const commentCount = async (setupId: string): Promise<number> => {
    const result = await database.query<{ count: string | number }>(
      'SELECT COUNT(*)::int AS count FROM setup_comments WHERE setup_id = $1',
      [setupId],
    );
    return Number(result.rows[0]?.count ?? 0);
  };

  try {
    const authorRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: author,
    });
    assert(authorRes.status === 201, `author register failed: ${JSON.stringify(authorRes.body)}`);
    const authorToken = authorRes.body.data?.token as string;
    const authorId = authorRes.body.data?.user.id as string;

    const peerRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: peer,
    });
    assert(peerRes.status === 201, `peer register failed: ${JSON.stringify(peerRes.body)}`);
    const peerToken = peerRes.body.data?.token as string;

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
      body: { role: 'moderator', reason: 'Appoint pit-note marshall' },
    });
    const modLogin = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/login', {
      body: { email: moderator.email, password: moderator.password },
    });
    const modToken = modLogin.body.data?.token as string;

    const vehicleRes = await requestJson<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: authorToken,
      body: {
        name: 'Notes Rig',
        make: 'Element',
        model: 'Enduro',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(vehicleRes.status === 201, 'vehicle create failed');
    const vehicleId = vehicleRes.body.data?.id as string;

    const publicRes = await requestJson<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: authorToken,
      body: {
        vehicleId,
        title: 'Public Pit Notes Sheet',
        isPublic: true,
        settings: setupSettings(),
      },
    });
    assert(publicRes.status === 201, `public setup failed: ${JSON.stringify(publicRes.body)}`);
    const publicSetup = publicRes.body.data as SetupEntity;

    const privateRes = await requestJson<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: authorToken,
      body: {
        vehicleId,
        title: 'Private Garage Tune',
        isPublic: false,
        settings: setupSettings(),
      },
    });
    assert(privateRes.status === 201, 'private setup failed');
    const privateSetup = privateRes.body.data as SetupEntity;

    const unauth = await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/comments`, {
      body: { body: 'guest note' },
    });
    assert(unauth.status === 401, `expected 401 without JWT, got ${unauth.status}`);

    await requestJson(baseUrl, 'PATCH', `/admin/users/${authorId}/suspension`, {
      token: adminToken,
      body: { suspend: true, reason: 'Temp pit lock' },
    });
    const suspendedPost = await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/comments`, {
      token: authorToken,
      body: { body: 'suspended note' },
    });
    assert(
      suspendedPost.status === 403,
      `expected 403 when suspended, got ${suspendedPost.status}`,
    );
    await requestJson(baseUrl, 'PATCH', `/admin/users/${authorId}/suspension`, {
      token: adminToken,
      body: { suspend: false },
    });
    const authorLogin = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/login', {
      body: { email: author.email, password: author.password },
    });
    const freshAuthorToken = authorLogin.body.data?.token as string;

    const privateList = await requestJson(baseUrl, 'GET', `/setups/${privateSetup.id}/comments`, {
      token: freshAuthorToken,
    });
    assert(
      privateList.status === 403,
      `owner list on private sheet expected 403, got ${privateList.status}`,
    );
    assert(
      privateList.body.message?.some((item) =>
        item.includes('Comments are only available on public sheets'),
      ),
      `private list message missing: ${JSON.stringify(privateList.body)}`,
    );

    const privatePost = await requestJson(baseUrl, 'POST', `/setups/${privateSetup.id}/comments`, {
      token: freshAuthorToken,
      body: { body: 'should not land' },
    });
    assert(privatePost.status === 403, `private post expected 403, got ${privatePost.status}`);
    assert((await commentCount(privateSetup.id)) === 0, 'private sheet inserted a comment');

    const peerPrivate = await requestJson(baseUrl, 'GET', `/setups/${privateSetup.id}/comments`, {
      token: peerToken,
    });
    assert(peerPrivate.status === 404, `peer private list expected 404, got ${peerPrivate.status}`);

    await requestJson(baseUrl, 'PATCH', `/admin/setups/${publicSetup.id}/visibility`, {
      token: modToken,
      body: { hide: true, reason: 'Temp hide for comment gate' },
    });
    const hiddenPost = await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/comments`, {
      token: freshAuthorToken,
      body: { body: 'hidden sheet note' },
    });
    assert(hiddenPost.status === 404, `hidden post expected 404, got ${hiddenPost.status}`);
    assert((await commentCount(publicSetup.id)) === 0, 'hidden sheet inserted a comment');
    await requestJson(baseUrl, 'PATCH', `/admin/setups/${publicSetup.id}/visibility`, {
      token: modToken,
      body: { hide: false },
    });

    const missing = await requestJson(
      baseUrl,
      'POST',
      '/setups/00000000-0000-4000-8000-000000000000/comments',
      {
        token: freshAuthorToken,
        body: { body: 'ghost' },
      },
    );
    assert(missing.status === 404, `missing setup expected 404, got ${missing.status}`);

    const tooLong = await requestJson<SetupComment>(
      baseUrl,
      'POST',
      `/setups/${publicSetup.id}/comments`,
      {
        token: freshAuthorToken,
        body: { body: 'x'.repeat(2001) },
      },
    );
    assert(tooLong.status === 400, `2001-char body expected 400, got ${tooLong.status}`);

    const first = await requestJson<SetupComment>(
      baseUrl,
      'POST',
      `/setups/${publicSetup.id}/comments`,
      {
        token: freshAuthorToken,
        body: { body: 'First pit note', parentId: 'should-be-stripped' },
      },
    );
    assert(first.status === 201, `first comment failed: ${JSON.stringify(first.body)}`);
    assert(first.body.data?.body === 'First pit note', 'first body mismatch');
    assert(first.body.data?.author.callsign === author.callsign, 'author callsign missing');
    assert(first.body.data?.isAuthor === true, 'author should see isAuthor');
    const firstId = first.body.data?.id as string;

    const rapid = await requestJson(baseUrl, 'POST', `/setups/${publicSetup.id}/comments`, {
      token: freshAuthorToken,
      body: { body: 'Too soon' },
    });
    assert(rapid.status === 429, `second post within 15s expected 429, got ${rapid.status}`);

    const peerNote = await requestJson<SetupComment>(
      baseUrl,
      'POST',
      `/setups/${publicSetup.id}/comments`,
      {
        token: peerToken,
        body: { body: 'Peer trail observation' },
      },
    );
    assert(peerNote.status === 201, `peer comment failed: ${JSON.stringify(peerNote.body)}`);
    const peerId = peerNote.body.data?.id as string;

    const listed = await requestJson<PaginatedComments>(
      baseUrl,
      'GET',
      `/setups/${publicSetup.id}/comments`,
      { token: peerToken },
    );
    assert(listed.status === 200, `list failed: ${JSON.stringify(listed.body)}`);
    const items = listed.body.data?.items ?? [];
    assert(items.length === 2, `expected 2 notes, got ${items.length}`);
    assert(items[0]?.body === 'First pit note', 'oldest-first order failed');
    assert(items[1]?.body === 'Peer trail observation', 'second note missing');
    assert(items[0]?.isAuthor === false, 'peer should not own author note');
    assert(items[1]?.isAuthor === true, 'peer should own their note');

    const guestList = await requestJson<PaginatedComments>(
      baseUrl,
      'GET',
      `/setups/${publicSetup.id}/comments`,
    );
    assert(guestList.status === 200, 'guest list should succeed');
    assert(
      guestList.body.data?.items.every((item) => item.isAuthor === false),
      'guest list must not mark isAuthor',
    );

    const foreignDelete = await requestJson(baseUrl, 'DELETE', `/comments/${firstId}`, {
      token: peerToken,
    });
    assert(foreignDelete.status === 403, `peer delete expected 403, got ${foreignDelete.status}`);

    const deleted = await requestJson<DeleteCommentResult>(baseUrl, 'DELETE', `/comments/${firstId}`, {
      token: freshAuthorToken,
    });
    assert(deleted.status === 200, `author delete failed: ${JSON.stringify(deleted.body)}`);
    assert(deleted.body.data?.deleted === true, 'delete payload missing');

    const afterDelete = await requestJson<PaginatedComments>(
      baseUrl,
      'GET',
      `/setups/${publicSetup.id}/comments`,
    );
    assert(
      (afterDelete.body.data?.items ?? []).every((item) => item.id !== firstId),
      'deleted note still listed',
    );

    await database.query(
      `UPDATE setup_comments SET created_at = NOW() - INTERVAL '20 seconds' WHERE id = $1`,
      [peerId],
    );

    const reportable = await requestJson<SetupComment>(
      baseUrl,
      'POST',
      `/setups/${publicSetup.id}/comments`,
      {
        token: peerToken,
        body: { body: 'Report this note' },
      },
    );
    assert(reportable.status === 201, `reportable comment failed: ${JSON.stringify(reportable.body)}`);
    const reportableId = reportable.body.data?.id as string;

    const selfReport = await requestJson(baseUrl, 'POST', '/reports', {
      token: peerToken,
      body: {
        targetType: 'comment',
        targetId: reportableId,
        reasonCode: 'spam',
      },
    });
    assert(selfReport.status === 400, `self comment report expected 400, got ${selfReport.status}`);

    const filed = await requestJson<CreatedReport>(baseUrl, 'POST', '/reports', {
      token: freshAuthorToken,
      body: {
        targetType: 'comment',
        targetId: reportableId,
        reasonCode: 'spam',
      },
    });
    assert(filed.status === 201, `comment report failed: ${JSON.stringify(filed.body)}`);
    const reportId = filed.body.data?.id as string;

    const queue = await requestJson<PaginatedAdminReports>(baseUrl, 'GET', '/admin/reports', {
      token: modToken,
    });
    const queued = queue.body.data?.items.find((item) => item.id === reportId);
    assert(queued?.targetType === 'comment', 'queue missing comment target');
    assert(queued?.targetLabel.includes('Report this note'), `queue label: ${queued?.targetLabel}`);

    const resolved = await requestJson<AdminReportSummary>(
      baseUrl,
      'PATCH',
      `/admin/reports/${reportId}`,
      {
        token: modToken,
        body: {
          status: 'actioned',
          reason: 'Hide abusive pit note',
          hideComment: true,
        },
      },
    );
    assert(resolved.status === 200, `resolve failed: ${JSON.stringify(resolved.body)}`);

    const afterHide = await requestJson<PaginatedComments>(
      baseUrl,
      'GET',
      `/setups/${publicSetup.id}/comments`,
    );
    assert(
      (afterHide.body.data?.items ?? []).every((item) => item.id !== reportableId),
      'hidden comment still listed',
    );

    await database.query(
      `UPDATE setup_comments SET created_at = NOW() - INTERVAL '20 seconds' WHERE author_user_id = $1`,
      [authorId],
    );
    const patchTarget = await requestJson<SetupComment>(
      baseUrl,
      'POST',
      `/setups/${publicSetup.id}/comments`,
      {
        token: freshAuthorToken,
        body: { body: 'Moderator will hide me' },
      },
    );
    assert(patchTarget.status === 201, `patch-target comment failed: ${JSON.stringify(patchTarget.body)}`);
    const patchId = patchTarget.body.data?.id as string;

    const patched = await requestJson<AdminCommentSummary>(
      baseUrl,
      'PATCH',
      `/admin/comments/${patchId}/visibility`,
      {
        token: modToken,
        body: { hide: true, reason: 'Direct hide from desk' },
      },
    );
    assert(patched.status === 200, `visibility patch failed: ${JSON.stringify(patched.body)}`);
    assert(patched.body.data?.isHidden === true, 'comment should be hidden');

    const afterPatch = await requestJson<PaginatedComments>(
      baseUrl,
      'GET',
      `/setups/${publicSetup.id}/comments`,
    );
    assert(
      (afterPatch.body.data?.items ?? []).every((item) => item.id !== patchId),
      'patched-hidden comment still listed',
    );

    const audit = await requestJson<PaginatedAuditLog>(baseUrl, 'GET', '/admin/audit-log?limit=50', {
      token: modToken,
    });
    const actions = (audit.body.data?.items ?? []).map((entry) => `${entry.action}:${entry.targetType}`);
    assert(
      actions.includes('comment.hide:comment'),
      `missing comment.hide audit: ${actions.join(',')}`,
    );
    assert(
      actions.includes('report.resolve:comment'),
      `missing report.resolve audit: ${actions.join(',')}`,
    );
  } finally {
    await database.query('DELETE FROM users WHERE email = ANY($1)', [
      [author.email, peer.email, admin.email, moderator.email],
    ]);
  }
}

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone19-e2e-secret';
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
    await runSetupCommentsVerification(baseUrl, database);
    console.log('[Setup Comments] public notes, rate limit, delete, and hide passed');
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
