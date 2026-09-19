/**
 * Purpose: exercise Milestone 15 account lifecycle without SMTP or email verification.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AuthMeResponse, AuthTokenResponse, UserProfile } from '../src/contracts/auth.contract';
import { LikeToggleResult } from '../src/contracts/feed.contract';
import { SetupEntity } from '../src/contracts/setup.contract';
import { VehicleEntity } from '../src/contracts/vehicle.contract';
import { DatabaseService } from '../src/database/database.service';

interface Envelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: string;
  message?: string[];
}

interface Queryable {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
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

function buildSettings() {
  return {
    drivetrain: {
      pinionTeeth: 14,
      spurTeeth: 56,
      transmissionInternalRatio: 3.0,
    },
    suspension: {
      front: {
        oilViscosityValue: 30,
        oilViscosityUnit: 'WT' as const,
        springRateDescription: '1.4 lb/in',
        shockLengthEyeToEyeMm: 90,
        rideHeightMm: 28,
      },
      rear: {
        oilViscosityValue: 30,
        oilViscosityUnit: 'WT' as const,
        springRateDescription: '1.2 lb/in',
        shockLengthEyeToEyeMm: 90,
        rideHeightMm: 28,
      },
      portalGearsInstalled: false,
    },
    tiresAndWeight: {
      front: { brand: 'Pro-Line', model: 'Hyrax 1.9', compound: 'Predator' },
      rear: { brand: 'Pro-Line', model: 'Hyrax 1.9', compound: 'Predator' },
      weight: {
        totalRtrWeightGrams: 2500,
        frontAxleWeightGrams: 1500,
        rearAxleWeightGrams: 1000,
      },
    },
    trackConditions: {
      surface: 'slick_rock',
      grip: 'high',
      locationTag: 'Moab Slickrock Trail',
    },
  };
}

/**
 * Purpose: verify age gate, password policy, settings mutations, self-delete, and unverified community writes.
 */
export async function runAuthLifecycleVerification(
  baseUrl: string,
  database?: Queryable,
): Promise<void> {
  const stamp = Date.now();
  console.log(`[Auth Lifecycle] Beginning Milestone 15 verification (stamp: ${stamp})`);

  const driverA = {
    email: `life.a.${stamp}@example.com`,
    password: 'password123',
    ageAttested: true as const,
    callsign: `life_a_${stamp}`.slice(0, 30),
  };
  const driverB = {
    email: `life.b.${stamp}@example.com`,
    password: 'password123',
    ageAttested: true as const,
    callsign: `life_b_${stamp}`.slice(0, 30),
  };
  const occupier = {
    email: `life.occ.${stamp}@example.com`,
    password: 'password123',
    ageAttested: true as const,
    callsign: `life_occ_${stamp}`.slice(0, 30),
  };
  const lastAdmin = {
    email: `life.admin.${stamp}@example.com`,
    password: 'password123',
    ageAttested: true as const,
    callsign: `life_adm_${stamp}`.slice(0, 30),
  };
  const missingAgeEmail = `life.noage.${stamp}@example.com`;
  const shortPassEmail = `life.short.${stamp}@example.com`;

  try {
    const noAge = await requestJson(baseUrl, 'POST', '/auth/register', {
      body: {
        email: missingAgeEmail,
        password: 'password123',
        callsign: `life_na_${stamp}`.slice(0, 30),
      },
    });
    assert(noAge.status === 400, `register without ageAttested should 400, got ${noAge.status}`);
    assert(
      (noAge.body.message ?? []).some((item) => item.includes('ageAttested')),
      `ageAttested field error missing: ${JSON.stringify(noAge.body)}`,
    );

    const shortPass = await requestJson(baseUrl, 'POST', '/auth/register', {
      body: {
        email: shortPassEmail,
        password: 'pass1234x',
        callsign: `life_pw_${stamp}`.slice(0, 30),
        ageAttested: true,
      },
    });
    assert(shortPass.status === 400, `9-character password should 400, got ${shortPass.status}`);

    if (database) {
      const leaked = await database.query(
        'SELECT COUNT(*)::int AS count FROM users WHERE email = ANY($1)',
        [[missingAgeEmail, shortPassEmail]],
      );
      assert(Number(leaked.rows[0]?.count ?? 1) === 0, 'failed register must not insert a user');
    }

    const registerA = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: driverA,
    });
    assert(registerA.status === 201, `register A failed: ${JSON.stringify(registerA.body)}`);
    const tokenA = registerA.body.data?.token;
    assert(tokenA, 'driver A token missing');

    if (database) {
      const attested = await database.query(
        'SELECT age_attested_at FROM users WHERE email = $1',
        [driverA.email],
      );
      assert(attested.rows[0]?.age_attested_at, 'age_attested_at must be set on register');
    }

    const occupierRes = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: occupier,
    });
    assert(occupierRes.status === 201, 'occupier register failed');

    const registerB = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: driverB,
    });
    assert(registerB.status === 201, 'register B failed');
    const tokenB = registerB.body.data?.token;
    assert(tokenB, 'driver B token missing');

    const vehicleA = await requestJson<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Lifecycle Sendero',
        make: 'Element',
        model: 'Enduro Sendero HD',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(vehicleA.status === 201, `create vehicle A failed: ${JSON.stringify(vehicleA.body)}`);
    const vehicleAId = vehicleA.body.data?.id;
    assert(vehicleAId, 'vehicle A id missing');

    const vehicleB = await requestJson<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: tokenB,
      body: {
        name: 'Lifecycle Axial',
        make: 'Axial',
        model: 'SCX10 III',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(vehicleB.status === 201, 'create vehicle B failed');
    const vehicleBId = vehicleB.body.data?.id;
    assert(vehicleBId, 'vehicle B id missing');

    const publicSetup = await requestJson<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Lifecycle Moab Spec',
        isPublic: true,
        settings: buildSettings(),
      },
    });
    assert(
      publicSetup.status === 201,
      `unverified JWT must publish a public sheet, got ${publicSetup.status} ${JSON.stringify(publicSetup.body)}`,
    );
    const parentId = publicSetup.body.data?.id;
    assert(parentId, 'parent setup id missing');

    const liked = await requestJson<LikeToggleResult>(
      baseUrl,
      'POST',
      `/setups/${parentId}/like`,
      { token: tokenB },
    );
    assert(liked.status === 200, `like without verify should 200, got ${liked.status}`);
    assert(liked.body.data?.liked === true, 'first like toggle should endorse the sheet');

    const forked = await requestJson<SetupEntity>(baseUrl, 'POST', `/setups/${parentId}/fork`, {
      token: tokenB,
      body: { targetVehicleId: vehicleBId, title: 'Lifecycle Fork' },
    });
    assert(forked.status === 201, `fork without verify should 201, got ${forked.status}`);
    const forkId = forked.body.data?.id;
    assert(forkId, 'fork id missing');
    assert(forked.body.data?.forkedFromSetupId === parentId, 'fork parent pointer missing');

    const badCurrent = await requestJson(baseUrl, 'POST', '/auth/change-password', {
      token: tokenA,
      body: { currentPassword: 'wrong-pass-1', nextPassword: 'password456' },
    });
    assert(badCurrent.status === 401, `wrong current password should 401, got ${badCurrent.status}`);

    const samePassword = await requestJson(baseUrl, 'POST', '/auth/change-password', {
      token: tokenA,
      body: { currentPassword: driverA.password, nextPassword: driverA.password },
    });
    assert(samePassword.status === 400, `identical next password should 400, got ${samePassword.status}`);

    const changedPassword = await requestJson<{ changed: true }>(
      baseUrl,
      'POST',
      '/auth/change-password',
      {
        token: tokenA,
        body: { currentPassword: driverA.password, nextPassword: 'password456' },
      },
    );
    assert(
      changedPassword.status === 200 && changedPassword.body.data?.changed === true,
      `change-password failed: ${JSON.stringify(changedPassword.body)}`,
    );
    driverA.password = 'password456';

    const oldLogin = await requestJson(baseUrl, 'POST', '/auth/login', {
      body: { email: driverA.email, password: 'password123' },
    });
    assert(oldLogin.status === 401, 'legacy password must fail after rotation');

    const newLogin = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/login', {
      body: { email: driverA.email, password: driverA.password },
    });
    assert(newLogin.status === 200, 'login with rotated password should succeed');

    const takenEmail = await requestJson(baseUrl, 'POST', '/auth/change-email', {
      token: tokenA,
      body: { password: driverA.password, nextEmail: occupier.email },
    });
    assert(takenEmail.status === 409, `taken email should 409, got ${takenEmail.status}`);

    const nextEmail = `life.next.${stamp}@example.com`;
    const changedEmail = await requestJson<UserProfile>(baseUrl, 'POST', '/auth/change-email', {
      token: tokenA,
      body: { password: driverA.password, nextEmail },
    });
    assert(changedEmail.status === 200, `change-email failed: ${JSON.stringify(changedEmail.body)}`);
    assert(changedEmail.body.data?.email === nextEmail, 'change-email must persist immediately');
    driverA.email = nextEmail;

    const meAfterEmail = await requestJson<AuthMeResponse>(baseUrl, 'GET', '/auth/me', {
      token: tokenA,
    });
    assert(meAfterEmail.body.data?.email === nextEmail, '/auth/me must reflect the new email');

    const httpAvatar = await requestJson(baseUrl, 'PATCH', '/auth/profile', {
      token: tokenA,
      body: { avatarUrl: 'http://example.com/avatar.png' },
    });
    assert(httpAvatar.status === 400, `http avatar should 400, got ${httpAvatar.status}`);

    const bio = 'B'.repeat(250);
    const httpsAvatar = 'https://cdn.example.com/lifecycle.png';
    const profile = await requestJson<UserProfile>(baseUrl, 'PATCH', '/auth/profile', {
      token: tokenA,
      body: { bio, avatarUrl: httpsAvatar },
    });
    assert(profile.status === 200, `profile patch failed: ${JSON.stringify(profile.body)}`);
    assert(profile.body.data?.bio === bio, 'bio must persist at 250 characters');
    assert(profile.body.data?.avatarUrl === httpsAvatar, 'https avatarUrl must persist');

    const meAfterProfile = await requestJson<AuthMeResponse>(baseUrl, 'GET', '/auth/me', {
      token: tokenA,
    });
    assert(meAfterProfile.body.data?.bio === bio, '/auth/me bio mismatch');
    assert(meAfterProfile.body.data?.avatarUrl === httpsAvatar, '/auth/me avatar mismatch');

    if (database) {
      const adminReg = await requestJson<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
        body: lastAdmin,
      });
      assert(adminReg.status === 201, 'last-admin register failed');
      const adminId = adminReg.body.data?.user.id;
      assert(adminId, 'last-admin id missing');
      await database.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminId]);

      const others = await database.query(
        `SELECT id FROM users WHERE role = 'admin' AND is_suspended = FALSE AND id <> $1`,
        [adminId],
      );
      const otherIds = others.rows.map((row) => String(row.id));
      if (otherIds.length > 0) {
        await database.query(`UPDATE users SET is_suspended = TRUE WHERE id = ANY($1::uuid[])`, [
          otherIds,
        ]);
      }
      try {
        const lastAdminDelete = await requestJson(baseUrl, 'DELETE', '/auth/me', {
          token: adminReg.body.data?.token,
          body: { password: lastAdmin.password, confirmation: 'DELETE' },
        });
        assert(
          lastAdminDelete.status === 409,
          `last admin delete should 409, got ${lastAdminDelete.status}`,
        );
        assert(
          (lastAdminDelete.body.message ?? []).includes('Cannot delete the last administrator'),
          `last-admin message mismatch: ${JSON.stringify(lastAdminDelete.body)}`,
        );
      } finally {
        if (otherIds.length > 0) {
          await database.query(
            `UPDATE users SET is_suspended = FALSE WHERE id = ANY($1::uuid[])`,
            [otherIds],
          );
        }
      }
    }

    const deleted = await requestJson<{ deleted: true }>(baseUrl, 'DELETE', '/auth/me', {
      token: tokenA,
      body: { password: driverA.password, confirmation: 'DELETE' },
    });
    assert(deleted.status === 200, `self-delete failed: ${JSON.stringify(deleted.body)}`);
    assert(deleted.body.data?.deleted === true, 'self-delete payload should mark deleted');

    const loginGone = await requestJson(baseUrl, 'POST', '/auth/login', {
      body: { email: driverA.email, password: driverA.password },
    });
    assert(loginGone.status === 401, 'deleted account login should 401');

    const forkAfter = await requestJson<SetupEntity>(baseUrl, 'GET', `/setups/${forkId}`, {
      token: tokenB,
    });
    assert(forkAfter.status === 200, 'fork child must survive author self-delete');
    assert(
      forkAfter.body.data?.forkedFromSetupId == null,
      'parent lineage pointer must null out after author delete',
    );

    console.log('[Auth Lifecycle] All Milestone 15 acceptance checks passed');
  } finally {
    if (database) {
      await database.query('DELETE FROM users WHERE email = ANY($1)', [
        [
          driverA.email,
          driverB.email,
          occupier.email,
          lastAdmin.email,
          missingAgeEmail,
          shortPassEmail,
          `life.next.${stamp}@example.com`,
        ],
      ]);
    }
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone15-e2e-secret';
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
    await runAuthLifecycleVerification(baseUrl, database);
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
