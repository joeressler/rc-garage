/**
 * Purpose: exercise Milestone 8 public feed filters, keyset pagination, and atomic likes.
 */
import { AddressInfo } from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AuthTokenResponse } from '../src/contracts/auth.contract';
import {
  LikeToggleResult,
  PaginatedFeedResponse,
} from '../src/contracts/feed.contract';
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

function buildSettings(surface: 'granite_rock' | 'slick_rock', locationTag: string) {
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
      surface,
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
    process.env.JWT_SECRET = 'milestone8-e2e-secret';
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
  const make = `FeedCo${stamp}`;
  const crawlerModel = `Phoenix${stamp}`.slice(0, 50);
  const scModel = `Slash${stamp}`.slice(0, 50);

  const userA = {
    email: `feed.a.${stamp}@example.com`,
    password: 'pit-mat-pass-1',
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
    callsign: `feed_a_${stamp}`.slice(0, 30),
  };
  const userB = {
    email: `feed.b.${stamp}@example.com`,
    password: 'pit-mat-pass-2',
    ageAttested: true as const,
    acceptedLegal: true as const,
    recaptchaToken: 'dev-bypass',
    callsign: `feed_b_${stamp}`.slice(0, 30),
  };

  try {
    await database.migrateUp();

    const registerA = await request<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: userA,
    });
    assert(registerA.status === 201, `register A failed: ${registerA.status}`);
    const tokenA = registerA.body.data?.token;
    assert(tokenA, 'driver A token missing');

    const registerB = await request<AuthTokenResponse>(baseUrl, 'POST', '/auth/register', {
      body: userB,
    });
    assert(registerB.status === 201, `register B failed: ${registerB.status}`);
    const tokenB = registerB.body.data?.token;
    assert(tokenB, 'driver B token missing');

    const vehicleA = await request<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Phoenix Trail Rig',
        make,
        model: crawlerModel,
        vehicleClass: 'crawler_scale',
      },
    });
    assert(vehicleA.status === 201, `create crawler failed: ${vehicleA.status}`);
    const vehicleAId = vehicleA.body.data?.id;
    assert(vehicleAId, 'crawler vehicle id missing');

    const vehicleB = await request<VehicleEntity>(baseUrl, 'POST', '/vehicles', {
      token: tokenA,
      body: {
        name: 'Short Course Bash',
        make,
        model: scModel,
        vehicleClass: 'short_course',
      },
    });
    assert(vehicleB.status === 201, `create short course failed: ${vehicleB.status}`);
    const vehicleBId = vehicleB.body.data?.id;
    assert(vehicleBId, 'short course vehicle id missing');

    const graniteIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const created = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
        token: tokenA,
        body: {
          vehicleId: vehicleAId,
          title: `Granite Spec ${index}`,
          tags: ['moab', 'comp'],
          settings: buildSettings('granite_rock', 'Moab Rim'),
        },
      });
      assert(created.status === 201, `create granite ${index} failed: ${created.status}`);
      const id = created.body.data?.id;
      assert(id, `granite ${index} id missing`);
      graniteIds.push(id);
    }

    for (let index = 0; index < graniteIds.length; index += 1) {
      const createdAt = new Date(Date.now() - (graniteIds.length - index) * 60_000);
      await database.query(`UPDATE setups SET created_at = $1 WHERE id = $2`, [
        createdAt.toISOString(),
        graniteIds[index],
      ]);
    }

    const slick = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Slickrock Only',
        tags: ['slick'],
        settings: buildSettings('slick_rock', 'Slickrock Plateau'),
      },
    });
    assert(slick.status === 201, `create slick setup failed: ${slick.status}`);
    const slickId = slick.body.data?.id;
    assert(slickId, 'slick setup id missing');

    const privateSetup = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleAId,
        title: 'Night Practice',
        isPublic: false,
        settings: buildSettings('granite_rock', 'Moab Rim'),
      },
    });
    assert(privateSetup.status === 201, `create private setup failed: ${privateSetup.status}`);
    const privateId = privateSetup.body.data?.id;
    assert(privateId, 'private setup id missing');

    const scSetup = await request<SetupEntity>(baseUrl, 'POST', '/setups', {
      token: tokenA,
      body: {
        vehicleId: vehicleBId,
        title: 'SC Bash Tune',
        tags: ['bash'],
        settings: buildSettings('granite_rock', 'Local Club'),
      },
    });
    assert(scSetup.status === 201, `create short course setup failed: ${scSetup.status}`);
    const scSetupId = scSetup.body.data?.id;
    assert(scSetupId, 'short course setup id missing');

    const graniteQuery = `/feed?make=${encodeURIComponent(make)}&model=${encodeURIComponent(crawlerModel)}&surfaceType=granite_rock`;
    const publicFeed = await request<PaginatedFeedResponse>(baseUrl, 'GET', graniteQuery);
    assert(publicFeed.status === 200, `public feed failed: ${publicFeed.status}`);
    assert(publicFeed.body.success === true, 'feed envelope should succeed');
    const publicItems = publicFeed.body.data?.items ?? [];
    const publicIds = publicItems.map((item) => item.id);
    assert(
      publicIds.length === graniteIds.length,
      `expected ${graniteIds.length} granite crawler sheets, got ${publicIds.length}`,
    );
    assert(
      publicIds.every((id) => graniteIds.includes(id)),
      'feed should only return the public granite crawler sheets',
    );
    assert(!publicIds.includes(privateId), 'private setups must never appear in the feed');
    assert(!publicIds.includes(slickId), 'slickrock sheets must not match granite_rock');
    assert(!publicIds.includes(scSetupId), 'short course sheets must not match crawler model');
    assert(
      publicItems.every((item) => item.surfaceType === 'granite_rock'),
      'surface filter should utilize surface_type equality',
    );
    assert(
      publicItems.every((item) => item.isLikedByCaller === false),
      'anonymous callers are never marked as having liked a sheet',
    );
    assert(
      publicItems[0]?.author.callsign === userA.callsign,
      'feed cards should include the author callsign',
    );
    assert(
      publicItems[0]?.vehicle.make === make &&
        publicItems[0]?.vehicle.class === 'crawler_scale',
      'feed cards should include vehicle make and class',
    );

    const classFilter = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `/feed?make=${encodeURIComponent(make)}&class=short_course`,
    );
    assert(classFilter.status === 200, `class alias feed failed: ${classFilter.status}`);
    const classIds = (classFilter.body.data?.items ?? []).map((item) => item.id);
    assert(classIds.length === 1 && classIds[0] === scSetupId, 'class alias should isolate short course');

    const surfaceAlias = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `/feed?make=${encodeURIComponent(make)}&model=${encodeURIComponent(crawlerModel)}&surface=slick_rock`,
    );
    assert(surfaceAlias.status === 200, `surface alias feed failed: ${surfaceAlias.status}`);
    const slickIds = (surfaceAlias.body.data?.items ?? []).map((item) => item.id);
    assert(slickIds.length === 1 && slickIds[0] === slickId, 'surface alias should isolate slickrock');

    const tagFilter = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `/feed?make=${encodeURIComponent(make)}&tag=moab`,
    );
    const taggedIds = (tagFilter.body.data?.items ?? []).map((item) => item.id);
    assert(
      taggedIds.length === graniteIds.length && taggedIds.every((id) => graniteIds.includes(id)),
      'GIN tag containment should match moab granite sheets only',
    );

    const locationFilter = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `/feed?make=${encodeURIComponent(make)}&locationTag=Moab`,
    );
    const locationIds = (locationFilter.body.data?.items ?? []).map((item) => item.id);
    assert(locationIds.includes(graniteIds[0]), 'locationTag should match Moab Rim granite sheets');
    assert(!locationIds.includes(slickId), 'locationTag Moab should not include Slickrock Plateau');

    const pageOne = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `${graniteQuery}&limit=2`,
    );
    assert(pageOne.body.data?.hasMore === true, 'first page should report hasMore');
    const pageOneItems = pageOne.body.data?.items ?? [];
    assert(pageOneItems.length === 2, 'first page should contain two sheets');
    assert(pageOneItems[0]?.id === graniteIds[4], 'newest granite sheet should lead page one');
    assert(pageOneItems[1]?.id === graniteIds[3], 'second newest should follow on page one');
    const cursor = pageOne.body.data?.nextCursor;
    assert(cursor === graniteIds[3], 'nextCursor should be the last item on the page');

    const pageTwo = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `${graniteQuery}&limit=2&cursor=${cursor}`,
    );
    const pageTwoItems = pageTwo.body.data?.items ?? [];
    assert(pageTwoItems.length === 2, 'second page should contain two sheets');
    assert(pageTwo.body.data?.hasMore === true, 'second page should still have more');
    const pageTwoIds = pageTwoItems.map((item) => item.id);
    assert(
      pageTwoIds[0] === graniteIds[2] && pageTwoIds[1] === graniteIds[1],
      'keyset should advance without duplicates',
    );
    assert(
      pageOneItems.every((item) => !pageTwoIds.includes(item.id)),
      'pages must not overlap',
    );

    const pageThree = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `${graniteQuery}&limit=2&cursor=${pageTwo.body.data?.nextCursor}`,
    );
    const pageThreeItems = pageThree.body.data?.items ?? [];
    assert(pageThreeItems.length === 1, 'final page should contain the remaining sheet');
    assert(pageThreeItems[0]?.id === graniteIds[0], 'oldest granite sheet should close the feed');
    assert(pageThree.body.data?.hasMore === false, 'final page should not report hasMore');
    assert(pageThree.body.data?.nextCursor === null, 'final page nextCursor should be null');

    const badCursor = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `${graniteQuery}&cursor=00000000-0000-4000-8000-000000000099`,
    );
    assert(badCursor.status === 400, `unknown cursor should 400, got ${badCursor.status}`);

    const unauthLike = await request<LikeToggleResult>(
      baseUrl,
      'POST',
      `/setups/${graniteIds[4]}/like`,
    );
    assert(unauthLike.status === 401, `unauthenticated like should 401, got ${unauthLike.status}`);

    const privateLike = await request<LikeToggleResult>(
      baseUrl,
      'POST',
      `/setups/${privateId}/like`,
      { token: tokenB },
    );
    assert(
      privateLike.status === 404,
      `liking another driver's private sheet should 404, got ${privateLike.status}`,
    );

    const missingLike = await request<LikeToggleResult>(
      baseUrl,
      'POST',
      '/setups/00000000-0000-4000-8000-000000000099/like',
      { token: tokenA },
    );
    assert(missingLike.status === 404, `missing setup like should 404, got ${missingLike.status}`);

    const liked = await request<LikeToggleResult>(
      baseUrl,
      'POST',
      `/setups/${graniteIds[4]}/like`,
      { token: tokenA },
    );
    assert(liked.status === 200, `like toggle failed: ${liked.status}`);
    assert(liked.body.data?.liked === true, 'first toggle should like the sheet');
    assert(liked.body.data?.likeCount === 1, 'likeCount should increment to 1');

    const likedFeed = await request<PaginatedFeedResponse>(baseUrl, 'GET', graniteQuery, {
      token: tokenA,
    });
    const likedCard = (likedFeed.body.data?.items ?? []).find((item) => item.id === graniteIds[4]);
    assert(likedCard?.isLikedByCaller === true, 'caller JWT should annotate isLikedByCaller');
    assert(likedCard?.likeCount === 1, 'feed likeCount should match the toggle');

    const otherFeed = await request<PaginatedFeedResponse>(baseUrl, 'GET', graniteQuery, {
      token: tokenB,
    });
    const otherCard = (otherFeed.body.data?.items ?? []).find((item) => item.id === graniteIds[4]);
    assert(otherCard?.isLikedByCaller === false, 'a different caller is not marked as liking');

    const unliked = await request<LikeToggleResult>(
      baseUrl,
      'POST',
      `/setups/${graniteIds[4]}/like`,
      { token: tokenA },
    );
    assert(unliked.body.data?.liked === false, 'second toggle should unlike the sheet');
    assert(unliked.body.data?.likeCount === 0, 'likeCount should return to 0');

    const relike = await request<LikeToggleResult>(
      baseUrl,
      'POST',
      `/setups/${graniteIds[4]}/like`,
      { token: tokenA },
    );
    assert(relike.body.data?.liked === true, 'third toggle should like again');

    const mostLiked = await request<PaginatedFeedResponse>(
      baseUrl,
      'GET',
      `${graniteQuery}&sortBy=most_liked`,
    );
    const mostLikedItems = mostLiked.body.data?.items ?? [];
    assert(mostLikedItems[0]?.id === graniteIds[4], 'most_liked should rank the endorsed sheet first');
    assert(mostLikedItems[0]?.likeCount === 1, 'most_liked leader should show likeCount 1');

    const raceTarget = graniteIds[0];
    const raced = await Promise.all(
      Array.from({ length: 9 }, () =>
        request<LikeToggleResult>(baseUrl, 'POST', `/setups/${raceTarget}/like`, {
          token: tokenA,
        }),
      ),
    );
    assert(
      raced.every((result) => result.status === 200),
      'concurrent likes from one driver should all succeed',
    );
    const racedCount = await database.query<{ like_count: string | number }>(
      `SELECT like_count FROM setups WHERE id = $1`,
      [raceTarget],
    );
    const racedRows = await database.query<{ n: string | number }>(
      `SELECT COUNT(*)::int AS n FROM setup_likes WHERE setup_id = $1 AND user_id = (
         SELECT id FROM users WHERE email = $2
       )`,
      [raceTarget, userA.email],
    );
    const storedCount = Number(racedCount.rows[0].like_count);
    const storedLikes = Number(racedRows.rows[0].n);
    assert(storedLikes === 0 || storedLikes === 1, 'a driver can like a sheet at most once');
    assert(
      storedCount === storedLikes,
      `like_count drifted to ${storedCount} while setup_likes had ${storedLikes}`,
    );

    const dualTarget = graniteIds[1];
    const dual = await Promise.all([
      request<LikeToggleResult>(baseUrl, 'POST', `/setups/${dualTarget}/like`, { token: tokenA }),
      request<LikeToggleResult>(baseUrl, 'POST', `/setups/${dualTarget}/like`, { token: tokenB }),
    ]);
    assert(
      dual.every((result) => result.status === 200 && result.body.data?.liked === true),
      'two drivers should both be able to like the same public sheet',
    );
    const dualCount = await database.query<{ like_count: string | number }>(
      `SELECT like_count FROM setups WHERE id = $1`,
      [dualTarget],
    );
    assert(
      Number(dualCount.rows[0].like_count) === 2,
      'concurrent likes from two drivers should land at like_count 2',
    );

    console.log('community feed e2e: all acceptance checks passed');
  } finally {
    await database.query('DELETE FROM users WHERE email = ANY($1)', [
      [userA.email, userB.email],
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
