import { z } from 'zod';
import { SurfaceType, SurfaceTypeEnum } from './setup.contract';
import { VehicleClass, VehicleClassEnum } from './vehicle.contract';

const FeedSortBySchema = z.enum(['newest', 'most_forked', 'most_liked']);

/**
 * Purpose: treat blank query-string values as omitted filters.
 */
function blankToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

/**
 * Purpose: normalize Nest query bags and accept the tech-spec class/surface aliases.
 */
function normalizeFeedQuery(value: unknown): Record<string, unknown> {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};

  if (source.vehicleClass === undefined && source.class !== undefined) {
    source.vehicleClass = source.class;
  }
  if (source.surfaceType === undefined && source.surface !== undefined) {
    source.surfaceType = source.surface;
  }

  return {
    cursor: blankToUndefined(source.cursor),
    limit: blankToUndefined(source.limit),
    model: blankToUndefined(source.model),
    make: blankToUndefined(source.make),
    vehicleClass: blankToUndefined(source.vehicleClass),
    surfaceType: blankToUndefined(source.surfaceType),
    locationTag: blankToUndefined(source.locationTag),
    tag: blankToUndefined(source.tag),
    sortBy: blankToUndefined(source.sortBy),
  };
}

export const FeedQuerySchema = z.preprocess(
  normalizeFeedQuery,
  z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    model: z.string().min(1).max(50).optional(),
    make: z.string().min(1).max(50).optional(),
    vehicleClass: VehicleClassEnum.optional(),
    surfaceType: SurfaceTypeEnum.optional(),
    locationTag: z.string().min(1).max(80).optional(),
    tag: z.string().min(1).max(30).optional(),
    sortBy: FeedSortBySchema.default('newest'),
  }),
);

export type FeedQueryDto = z.infer<typeof FeedQuerySchema>;
export type FeedSortBy = z.infer<typeof FeedSortBySchema>;

export interface FeedAuthor {
  callsign: string;
  avatarUrl: string | null;
}

export interface FeedVehicle {
  make: string;
  model: string;
  class: VehicleClass;
}

export interface FeedItem {
  id: string;
  title: string;
  author: FeedAuthor;
  vehicle: FeedVehicle;
  calculatedFdr: number;
  frontBiasPercentage: number;
  surfaceType: SurfaceType;
  forkCount: number;
  likeCount: number;
  isLikedByCaller: boolean;
  qrSlug: string;
  createdAt: string;
}

export interface PaginatedFeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface LikeToggleResult {
  liked: boolean;
  likeCount: number;
}
