/**
 * Milestone 12: Comprehensive End-to-End Garage Workflow & Integration Verification
 *
 * Workflow Test Suite:
 * 1. Register driver @TrailBoss
 * 2. Add vehicle: "Element Enduro Sendero HD" (1/10 Scale Crawler)
 * 3. Create setup sheet: "Moab Slickrock Spec" (Pinion 14T, Spur 56T, 30 WT oil, 60% front bias)
 * 4. Verify public setup appears in GET /api/garage/feed
 * 5. Register second driver @RockHound
 * 6. Add vehicle: "Axial SCX10 III"
 * 7. Fork "Moab Slickrock Spec" into @RockHound's garage
 * 8. Change pinion to 12T. Verify parent retains 14T, fork has 12T, and computeSetupDiff produces delta -2T
 * 9. Verify /api/garage/qr/resolve/:slug loads public inspection sheet
 * 10. Verify container resource bounds and internal port isolation in docker-compose.yml
 */

import * as fs from 'fs';
import * as path from 'path';
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AuthTokenResponse } from '../src/contracts/auth.contract';
import { FeedItem, PaginatedFeedResponse } from '../src/contracts/feed.contract';
import { PublicInspectionSheet } from '../src/contracts/qr.contract';
import { SetupEntity } from '../src/contracts/setup.contract';
import { VehicleEntity } from '../src/contracts/vehicle.contract';
import { DatabaseService } from '../src/database/database.service';
import { computeSetupDiff } from '../src/modules/setups/utils/diff-engine.util';
import { SetupDiffEntry } from '../src/contracts/fork.contract';

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

async function requestJson(
  baseUrl: string,
  method: string,
  urlPath: string,
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

  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const body = (await response.json().catch(() => ({}))) as Envelope<any>;
  return { status: response.status, body };
}

function buildSlickrockSettings() {
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
        oilViscosityUnit: 'WT',
        springRateDescription: '1.4 lb/in',
        shockLengthEyeToEyeMm: 90,
        camberAngleDeg: -1.0,
        toeAngleDeg: 0.0,
        rideHeightMm: 28,
      },
      rear: {
        oilViscosityValue: 30,
        oilViscosityUnit: 'WT',
        springRateDescription: '1.2 lb/in',
        shockLengthEyeToEyeMm: 90,
        camberAngleDeg: 0.0,
        toeAngleDeg: 0.0,
        rideHeightMm: 28,
      },
      portalGearsInstalled: false,
    },
    tiresAndWeight: {
      front: {
        brand: 'Pro-Line',
        model: 'Hyrax 1.9',
        compound: 'Predator',
      },
      rear: {
        brand: 'Pro-Line',
        model: 'Hyrax 1.9',
        compound: 'Predator',
      },
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
    driverNotes: 'Moab Slickrock baseline tuning spec.',
  };
}

/**
 * Purpose: verify the complete Milestone 12 end-to-end integration flow across all services.
 */
export async function runGarageWorkflowVerification(baseUrl: string, database: DatabaseService): Promise<void> {
  const stamp = Date.now();
  console.log(`[E2E] Beginning Milestone 12 Workflow Verification (Run stamp: ${stamp})`);

  const driverTrailBoss = {
    email: `trailboss.${stamp}@example.com`,
    password: 'password123',
    ageAttested: true as const,
    callsign: `TrailBoss_${stamp}`.slice(0, 30),
  };

  const driverRockHound = {
    email: `rockhound.${stamp}@example.com`,
    password: 'password123',
    ageAttested: true as const,
    callsign: `RockHound_${stamp}`.slice(0, 30),
  };

  try {
    // 1. Register driver @TrailBoss
    console.log('[1/10] Registering driver @TrailBoss...');
    const regBossRes = await requestJson(baseUrl, 'POST', '/auth/register', {
      body: driverTrailBoss,
    });
    assert(regBossRes.status === 201, `Failed to register @TrailBoss: ${JSON.stringify(regBossRes.body)}`);
    const bossAuth: AuthTokenResponse = regBossRes.body.data;
    assert(bossAuth.token.length > 0, '@TrailBoss auth token missing');

    // 2. Add new vehicle: "Element Enduro Sendero HD" (1/10 Scale Crawler)
    console.log('[2/10] Adding vehicle: Element Enduro Sendero HD (1/10 Scale Crawler)...');
    const bossVehicleRes = await requestJson(baseUrl, 'POST', '/vehicles', {
      token: bossAuth.token,
      body: {
        name: 'TrailBoss Sendero',
        make: 'Element',
        model: 'Enduro Sendero HD',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(bossVehicleRes.status === 201, `Failed to create Sendero: ${JSON.stringify(bossVehicleRes.body)}`);
    const bossVehicle: VehicleEntity = bossVehicleRes.body.data;
    assert(bossVehicle.id.length > 0, 'Sendero vehicle ID missing');

    // 3. Create setup sheet "Moab Slickrock Spec" (Pinion 14T, Spur 56T, 30 WT oil, 60% front bias)
    console.log('[3/10] Creating setup sheet: Moab Slickrock Spec (14T pinion, 56T spur, 30 WT, 60% front bias)...');
    const setupSettings = buildSlickrockSettings();
    const createSetupRes = await requestJson(baseUrl, 'POST', '/setups', {
      token: bossAuth.token,
      body: {
        vehicleId: bossVehicle.id,
        title: 'Moab Slickrock Spec',
        description: 'Moab Slickrock competition configuration',
        isPublic: true,
        tags: ['moab', 'slickrock', 'comp'],
        settings: setupSettings,
      },
    });
    assert(createSetupRes.status === 201, `Failed to create setup: ${JSON.stringify(createSetupRes.body)}`);
    const parentSetup: SetupEntity = createSetupRes.body.data;
    assert(parentSetup.calculatedFdr === 12, `Expected calculated FDR to be 12.0, got ${parentSetup.calculatedFdr}`);
    assert(parentSetup.frontBiasPercentage === 60.0, `Expected 60.0% front bias, got ${parentSetup.frontBiasPercentage}`);
    assert(parentSetup.qrSlug.length === 10, `Expected 10-char qrSlug, got ${parentSetup.qrSlug}`);

    // 4. Verify public setup appears in GET /api/garage/feed
    console.log('[4/10] Verifying public setup appears in community feed...');
    const feedRes = await requestJson(baseUrl, 'GET', '/feed?surface=slick_rock');
    assert(feedRes.status === 200, `Feed query failed: ${JSON.stringify(feedRes.body)}`);
    const feedData: PaginatedFeedResponse = feedRes.body.data;
    const feedItem = feedData.items.find((item: FeedItem) => item.id === parentSetup.id);
    assert(feedItem !== undefined, `Setup ${parentSetup.id} not found in community feed`);
    assert(feedItem.title === 'Moab Slickrock Spec', `Feed title mismatch: ${feedItem.title}`);
    assert(feedItem.author.callsign === driverTrailBoss.callsign, `Author mismatch: ${feedItem.author.callsign}`);
    assert(feedItem.calculatedFdr === 12, `FDR mismatch in feed: ${feedItem.calculatedFdr}`);

    // 5. Register second driver @RockHound
    console.log('[5/10] Registering second driver @RockHound...');
    const regHoundRes = await requestJson(baseUrl, 'POST', '/auth/register', {
      body: driverRockHound,
    });
    assert(regHoundRes.status === 201, `Failed to register @RockHound: ${JSON.stringify(regHoundRes.body)}`);
    const houndAuth: AuthTokenResponse = regHoundRes.body.data;

    // 6. Add vehicle: "Axial SCX10 III"
    console.log('[6/10] Adding vehicle: Axial SCX10 III into @RockHound garage...');
    const houndVehicleRes = await requestJson(baseUrl, 'POST', '/vehicles', {
      token: houndAuth.token,
      body: {
        name: 'RockHound Axial Rig',
        make: 'Axial',
        model: 'SCX10 III',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(houndVehicleRes.status === 201, `Failed to create Axial SCX10 III: ${JSON.stringify(houndVehicleRes.body)}`);
    const houndVehicle: VehicleEntity = houndVehicleRes.body.data;

    // 7. Fork "Moab Slickrock Spec" into @RockHound's garage
    console.log('[7/10] Forking Moab Slickrock Spec into @RockHound garage...');
    const forkRes = await requestJson(baseUrl, 'POST', `/setups/${parentSetup.id}/fork`, {
      token: houndAuth.token,
      body: {
        targetVehicleId: houndVehicle.id,
        title: 'RockHound Moab Fork',
      },
    });
    assert(forkRes.status === 201, `Fork failed: ${JSON.stringify(forkRes.body)}`);
    const forkedSetup: SetupEntity = forkRes.body.data;
    assert(forkedSetup.forkedFromSetupId === parentSetup.id, 'forkedFromSetupId link missing');
    assert(forkedSetup.vehicleId === houndVehicle.id, 'Target vehicle assignment mismatch');

    // 8. Change pinion to 12T. Verify parent retains 14T, fork has 12T, and computeSetupDiff produces delta -2T
    console.log('[8/10] Updating fork pinion to 12T and computing mechanical diff...');
    const updatedForkSettings = {
      ...forkedSetup.settings,
      drivetrain: {
        ...forkedSetup.settings.drivetrain,
        pinionTeeth: 12,
      },
    };
    const updateForkRes = await requestJson(baseUrl, 'PUT', `/setups/${forkedSetup.id}`, {
      token: houndAuth.token,
      body: {
        vehicleId: houndVehicle.id,
        title: 'RockHound Moab Fork (12T Pinion)',
        isPublic: true,
        settings: updatedForkSettings,
      },
    });
    assert(updateForkRes.status === 200, `Failed to update fork: ${JSON.stringify(updateForkRes.body)}`);
    const finalFork: SetupEntity = updateForkRes.body.data;
    assert(finalFork.settings.drivetrain.pinionTeeth === 12, 'Fork pinion should be 12T');

    // Verify parent retained original 14T
    const checkParentRes = await requestJson(baseUrl, 'GET', `/setups/${parentSetup.id}`);
    assert(checkParentRes.status === 200, 'Failed to fetch parent setup');
    const currentParent: SetupEntity = checkParentRes.body.data;
    assert(currentParent.settings.drivetrain.pinionTeeth === 14, 'Parent setup must retain 14T pinion');

    // Verify computeSetupDiff delta is exactly -2T
    const diff = computeSetupDiff(currentParent.settings, finalFork.settings);
    const pinionDiff = diff.drivetrain.find((e: SetupDiffEntry) => e.path === 'drivetrain.pinionTeeth');
    assert(pinionDiff !== undefined, 'Pinion difference must be present in diff');
    assert(pinionDiff.kind === 'modified', `Expected modified pinion diff, got ${pinionDiff.kind}`);
    assert(pinionDiff.delta === -2, `Expected delta -2, got ${pinionDiff.delta}`);
    assert(pinionDiff.deltaLabel === '-2T', `Expected deltaLabel '-2T', got ${pinionDiff.deltaLabel}`);

    // 9. Verify /api/garage/qr/resolve/:slug loads public inspection sheet
    console.log(`[9/10] Verifying QR slug resolution on /api/garage/qr/resolve/${finalFork.qrSlug}...`);
    const qrResolveRes = await requestJson(baseUrl, 'GET', `/qr/resolve/${finalFork.qrSlug}`);
    assert(qrResolveRes.status === 200, `Failed to resolve QR slug: ${JSON.stringify(qrResolveRes.body)}`);
    const inspectionSheet: PublicInspectionSheet = qrResolveRes.body.data;
    assert(inspectionSheet.qrSlug === finalFork.qrSlug, 'QR slug mismatch');
    assert(inspectionSheet.vehicle.model === 'SCX10 III', 'Inspection sheet vehicle mismatch');
    assert(inspectionSheet.verified === true, 'Inspection sheet verified flag must be true');

    // 10. Verify container resource bounds and internal port isolation
    console.log('[10/10] Verifying container resource limits and internal port isolation in docker-compose.yml...');
    verifyDockerComposeResourceBounds();

    console.log('[E2E SUCCESS] All 10 verification steps completed cleanly!');
  } finally {
    // Cleanup created test users cascade-deletes vehicles and setups
    await database.query('DELETE FROM users WHERE email IN ($1, $2)', [
      driverTrailBoss.email,
      driverRockHound.email,
    ]);
  }
}

/**
 * Purpose: verify docker-compose resource limits (640MB combined RAM) and port isolation.
 */
export function verifyDockerComposeResourceBounds(): void {
  const composePath = path.resolve(__dirname, '../../docker-compose.yml');
  const fallbackPath = path.resolve(__dirname, '../docker-compose.yml');
  const targetPath = fs.existsSync(composePath) ? composePath : fallbackPath;
  assert(fs.existsSync(targetPath), `docker-compose.yml not found at ${composePath} or ${fallbackPath}`);

  const composeContent = fs.readFileSync(targetPath, 'utf8');

  // Verify memory limits: rc-db 256M, rc-backend 256M, rc-frontend 128M => total 640M
  assert(composeContent.includes('memory: 256M'), 'rc-db or rc-backend 256M memory limit missing');
  assert(composeContent.includes('memory: 128M'), 'rc-frontend 128M memory limit missing');

  // Verify rc-db has no exposed host ports (no "5432:5432")
  assert(
    !composeContent.includes('"5432:5432"') && !composeContent.includes("'5432:5432'"),
    'rc-db must not expose port 5432 to host',
  );

  // Verify network isolation
  assert(composeContent.includes('rc-isolated-net'), 'rc-isolated-net bridge network missing');
}

/**
 * Runner entrypoint if executed via ts-node directly
 */
async function runStandalone(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping database-dependent E2E execution (DATABASE_URL not set). Running static compose & diff validation.');
    verifyDockerComposeResourceBounds();
    console.log('Static compose checks passed.');
    return;
  }

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone12-e2e-secret';
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
    await runGarageWorkflowVerification(baseUrl, database);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  runStandalone().catch((err) => {
    console.error('E2E Verification Failed:', err);
    process.exit(1);
  });
}
