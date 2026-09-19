/**
 * Purpose: exercise crawler share HTML and the public-setup sitemap without a JS client.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
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
  applyE2eHardeningEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'milestone18-e2e-secret';
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
    email: `qr.share.${stamp}@example.com`,
    password: 'pit-mat-pass-1',
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
    callsign: `qr_share_${stamp}`.slice(0, 30),
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
      frontBiasPercentage: number;
    };

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

    const hiddenCreated = await requestJson(baseUrl, 'POST', '/setups', {
      token,
      body: {
        vehicleId,
        title: 'Hidden Comp Spec',
        settings: buildSettings(),
      },
    });
    assert(
      hiddenCreated.status === 201,
      `create hidden setup failed: ${hiddenCreated.status}`,
    );
    const hiddenSetup = hiddenCreated.body.data as {
      id: string;
      qrSlug: string;
    };
    await database.query('UPDATE setups SET is_hidden = TRUE WHERE id = $1', [
      hiddenSetup.id,
    ]);

    const share = await requestBytes(baseUrl, `/share/${publicSetup.qrSlug}`, {
      accept: 'text/html',
    });
    assert(share.status === 200, `public share should 200, got ${share.status}`);
    assert(
      share.contentType.includes('text/html'),
      `share content-type should be text/html, got ${share.contentType}`,
    );
    const shareHtml = share.body.toString('utf8');
    assert(
      !shareHtml.trimStart().startsWith('{'),
      'share HTML must not be wrapped in the JSON envelope',
    );
    assert(
      shareHtml.includes('<meta property="og:title"'),
      'share HTML must include og:title',
    );
    assert(
      shareHtml.includes(
        '<meta property="og:title" content="Rubicon Low-CoG Comp Spec"',
      ),
      'og:title content must be the setup title',
    );
    const ogImageMatch = shareHtml.match(
      /<meta property="og:image" content="([^"]+)"/,
    );
    assert(ogImageMatch, 'share HTML must include og:image');
    const ogImage = ogImageMatch[1].replace(/&amp;/g, '&');
    assert(
      /^https?:\/\//.test(ogImage),
      `og:image must be an absolute http(s) URL, got ${ogImage}`,
    );
    assert(
      ogImage ===
        `${expectedOrigin}/api/garage/setups/${publicSetup.id}/qr?format=png&size=512`,
      `og:image should be the QR PNG route, got ${ogImage}`,
    );
    assert(
      shareHtml.includes(`location.replace('/feed?inspect=' + encodeURIComponent("${publicSetup.id}"))`) ||
        shareHtml.includes(
          `location.replace('/feed?inspect=' + encodeURIComponent(${JSON.stringify(publicSetup.id)}))`,
        ),
      'share HTML must JS-replace onto /feed?inspect=',
    );

    const privateShare = await requestBytes(
      baseUrl,
      `/share/${privateSetup.qrSlug}`,
      { accept: 'text/html' },
    );
    assert(
      privateShare.status === 404,
      `private share should 404, got ${privateShare.status}`,
    );
    assert(
      privateShare.contentType.includes('text/html'),
      `private 404 should be HTML, got ${privateShare.contentType}`,
    );
    const privateHtml = privateShare.body.toString('utf8');
    assert(
      privateHtml.includes('noindex'),
      'private 404 HTML must include noindex',
    );
    assert(
      !privateHtml.includes('Night Practice'),
      'private 404 must not leak the setup title',
    );

    const hiddenShare = await requestBytes(
      baseUrl,
      `/share/${hiddenSetup.qrSlug}`,
      { accept: 'text/html' },
    );
    assert(
      hiddenShare.status === 404,
      `hidden share should 404, got ${hiddenShare.status}`,
    );
    const hiddenHtml = hiddenShare.body.toString('utf8');
    assert(
      !hiddenHtml.includes('Hidden Comp Spec'),
      'hidden 404 must not leak the setup title',
    );

    const sitemap = await requestBytes(baseUrl, '/sitemap.xml', {
      accept: 'application/xml',
    });
    assert(sitemap.status === 200, `sitemap should 200, got ${sitemap.status}`);
    assert(
      sitemap.contentType.includes('application/xml'),
      `sitemap content-type should be application/xml, got ${sitemap.contentType}`,
    );
    const sitemapXml = sitemap.body.toString('utf8');
    assert(
      sitemapXml.includes(`${expectedOrigin}/s/${publicSetup.qrSlug}`),
      'sitemap must list the public slug',
    );
    assert(
      sitemapXml.includes(`${expectedOrigin}/feed`),
      'sitemap must list the community feed',
    );
    assert(
      sitemapXml.includes(`${expectedOrigin}/legal/terms`),
      'sitemap must list legal terms',
    );
    assert(
      !sitemapXml.includes(`/s/${privateSetup.qrSlug}`),
      'sitemap must omit private sheets',
    );
    assert(
      !sitemapXml.includes(`/s/${hiddenSetup.qrSlug}`),
      'sitemap must omit hidden sheets',
    );

    console.log('qr share html e2e: all acceptance checks passed');
  } finally {
    await database.query('DELETE FROM users WHERE email = $1', [owner.email]);
    await app.close();
  }
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
  options: { accept: string },
): Promise<{ status: number; contentType: string; body: Buffer }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { Accept: options.accept },
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
