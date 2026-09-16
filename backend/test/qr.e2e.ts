/**
 * Purpose: exercise Milestone 7 Level-H QR sticker streams and public slug resolution.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { PublicInspectionSheet } from '../src/contracts/qr.contract';
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

function shockSpec() {
  return {
    oilViscosityValue: 425,
    oilViscosityUnit: 'CST' as const,
    springRateDescription: '3.2 lb/in',
    shockLengthEyeToEyeMm: 90,
    rideHeightMm: 28,
  };
}

function axleTires(compound: string) {
  return {
    brand: 'Pit Bull',
    model: 'Predator',
    compound,
  };
}

function buildSettings() {
  return {
    drivetrain: {
      pinionTeeth: 15,
      spurTeeth: 54,
      transmissionInternalRatio: 3,
      batteryCellCount: 3,
    },
    suspension: {
      front: shockSpec(),
      rear: { ...shockSpec(), oilViscosityValue: 350 },
      portalGearsInstalled: false,
    },
    tiresAndWeight: {
      front: axleTires('Alien'),
      rear: axleTires('Super Swamper'),
      weight: {
        totalRtrWeightGrams: 2500,
        frontAxleWeightGrams: 1480,
        rearAxleWeightGrams: 1020,
      },
    },
    trackConditions: {
      surface: 'granite_rock',
      grip: 'high',
      locationTag: 'Moab Rim',
    },
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone7-e2e-secret';
  }
  if (!process.env.APP_BASE_URL) {
    process.env.APP_BASE_URL = 'http://127.0.0.1:3742';
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
  const expectedOrigin = process.env.APP_BASE_URL.replace(/\/+$/, '');

  const owner = {
    email: `qr.owner.${stamp}@example.com`,
    password: 'pit-mat-pass-1',
    callsign: `qr_owner_${stamp}`.slice(0, 30),
  };

  try {
    await database.migrateUp();

    const register = await requestJson(baseUrl, 'POST', '/auth/register', {
      body: owner,
    });
    assert(register.status === 201, `register failed: ${register.status}`);
    const token = register.body.data.token as string;

    const vehicle = await requestJson(baseUrl, 'POST', '/vehicles', {
      token,
      body: {
        name: 'Phoenix Trail Rig',
        make: 'Vanquish',
        model: 'VS4-10 Phoenix',
      },
    });
    assert(vehicle.status === 201, `create vehicle failed: ${vehicle.status}`);
    const vehicleId = vehicle.body.data.id as string;

    const publicCreated = await requestJson(baseUrl, 'POST', '/setups', {
      token,
      body: {
        vehicleId,
        title: 'Rubicon Low-CoG Comp Spec',
        settings: buildSettings(),
      },
    });
    assert(
      publicCreated.status === 201,
      `create public setup failed: ${publicCreated.status}`,
    );
    const publicSetup = publicCreated.body.data as {
      id: string;
      qrSlug: string;
      calculatedFdr: number;
    };
    assert(publicSetup.qrSlug.length === 10, 'qr_slug must be 10 characters');

    const privateCreated = await requestJson(baseUrl, 'POST', '/setups', {
      token,
      body: {
        vehicleId,
        title: 'Night Practice',
        isPublic: false,
        settings: buildSettings(),
      },
    });
    assert(
      privateCreated.status === 201,
      `create private setup failed: ${privateCreated.status}`,
    );
    const privateSetup = privateCreated.body.data as {
      id: string;
      qrSlug: string;
    };

    const svgDefault = await requestBytes(baseUrl, `/setups/${publicSetup.id}/qr`);
    assert(svgDefault.status === 200, `default QR should 200, got ${svgDefault.status}`);
    assert(
      svgDefault.contentType.includes('image/svg+xml'),
      `default QR content-type should be SVG, got ${svgDefault.contentType}`,
    );
    const svgText = svgDefault.body.toString('utf8');
    assert(svgText.includes('<svg'), 'SVG QR must contain an svg matrix');
    assert(
      !svgText.trimStart().startsWith('{'),
      'SVG QR must not be wrapped in the JSON envelope',
    );

    const png = await requestBytes(
      baseUrl,
      `/setups/${publicSetup.id}/qr?format=png&size=512&margin=2`,
    );
    assert(png.status === 200, `PNG QR should 200, got ${png.status}`);
    assert(
      png.contentType.includes('image/png'),
      `PNG content-type should be image/png, got ${png.contentType}`,
    );
    assert(
      png.body.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
      'PNG QR must start with PNG magic bytes',
    );

    const decoded = decodePngQr(png.body);
    const expectedPayload = `${expectedOrigin}/s/${publicSetup.qrSlug}`;
    assert(
      decoded === expectedPayload,
      `PNG QR payload should be ${expectedPayload}, got ${decoded}`,
    );

    const missingSetup = await requestBytes(
      baseUrl,
      '/setups/00000000-0000-4000-8000-000000000001/qr',
    );
    assert(
      missingSetup.status === 404,
      `unknown setup QR should 404, got ${missingSetup.status}`,
    );

    const badFormat = await requestJson(
      baseUrl,
      'GET',
      `/setups/${publicSetup.id}/qr?format=gif`,
    );
    assert(badFormat.status === 400, `invalid format should 400, got ${badFormat.status}`);

    const badSize = await requestJson(
      baseUrl,
      'GET',
      `/setups/${publicSetup.id}/qr?size=32`,
    );
    assert(badSize.status === 400, `undersized QR should 400, got ${badSize.status}`);

    const resolved = await requestJson(
      baseUrl,
      'GET',
      `/qr/resolve/${publicSetup.qrSlug}`,
    );
    assert(resolved.status === 200, `resolve public slug should 200, got ${resolved.status}`);
    assert(resolved.body.success === true, 'resolve should use the success envelope');
    const sheet = resolved.body.data as PublicInspectionSheet;
    assert(sheet?.setupId === publicSetup.id, 'resolve should return the setup id');
    assert(sheet?.qrSlug === publicSetup.qrSlug, 'resolve should echo the chassis slug');
    assert(sheet?.shortUrl === expectedPayload, 'resolve shortUrl must match QR payload');
    assert(sheet?.title === 'Rubicon Low-CoG Comp Spec', 'resolve should return the sheet title');
    assert(sheet?.vehicle.make === 'Vanquish', 'inspection sheet should include vehicle make');
    assert(
      sheet?.vehicle.model === 'VS4-10 Phoenix',
      'inspection sheet should include vehicle model',
    );
    assert(
      sheet?.vehicle.vehicleClass === 'crawler_scale',
      'inspection sheet should include vehicle class',
    );
    assert(sheet?.batteryCellCount === 3, 'inspection sheet should include battery cell count');
    assert(
      sheet?.calculatedFdr === publicSetup.calculatedFdr,
      'inspection sheet should include calculated FDR',
    );
    assert(sheet?.frontShock.oilViscosityUnit === 'CST', 'front shock unit should pass through');
    assert(sheet?.frontTire.compound === 'Alien', 'front tire compound should pass through');
    assert(
      sheet?.rearTire.compound === 'Super Swamper',
      'rear tire compound should pass through',
    );
    assert(sheet?.verified === true, 'public inspection sheets are scrutineering-verified');

    const privateQr = await requestBytes(baseUrl, `/setups/${privateSetup.id}/qr`);
    assert(
      privateQr.status === 200,
      `owner UUID QR for a private setup should 200, got ${privateQr.status}`,
    );

    const privateResolve = await requestJson(
      baseUrl,
      'GET',
      `/qr/resolve/${privateSetup.qrSlug}`,
    );
    assert(
      privateResolve.status === 404,
      `private slug resolve should 404, got ${privateResolve.status}`,
    );

    const unknownSlug = await requestJson(baseUrl, 'GET', '/qr/resolve/abcdefghij');
    assert(
      unknownSlug.status === 404,
      `unknown slug should 404, got ${unknownSlug.status}`,
    );

    const shortSlug = await requestJson(baseUrl, 'GET', '/qr/resolve/short');
    assert(shortSlug.status === 400, `short slug should 400, got ${shortSlug.status}`);

    console.log('qr engine e2e: all acceptance checks passed');
  } finally {
    await database.query('DELETE FROM users WHERE email = $1', [owner.email]);
    await app.close();
  }
}

function decodePngQr(body: Buffer): string | null {
  const png = PNG.sync.read(body);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return decoded?.data ?? null;
}

async function requestJson(
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

async function requestBytes(
  baseUrl: string,
  path: string,
): Promise<{ status: number; contentType: string; body: Buffer }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { Accept: 'image/svg+xml,image/png,application/json' },
  });
  const arrayBuffer = await response.arrayBuffer();
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: Buffer.from(arrayBuffer),
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
