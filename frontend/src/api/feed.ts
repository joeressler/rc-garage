import { apiJson } from './http';
import type { SurfaceType } from './setups';
import type { VehicleClass } from './vehicles';

export type FeedSortBy = 'newest' | 'most_forked' | 'most_liked';

export interface FeedFilters {
  cursor?: string;
  limit?: number;
  model?: string;
  vehicleModel?: string;
  make?: string;
  vehicleClass?: VehicleClass;
  surfaceType?: SurfaceType;
  locationTag?: string;
  tag?: string;
  sortBy?: FeedSortBy;
}

export type FeedQueryOptions = FeedFilters;

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

/**
 * Purpose: query the public community discovery feed with optional multi-vector filters and keyset cursor pagination.
 */
export function apiGetFeed(
  options: FeedQueryOptions = {},
  token?: string | null,
): Promise<PaginatedFeedResponse> {
  const query = new URLSearchParams();

  if (options.cursor) query.set('cursor', options.cursor);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.model) query.set('model', options.model);
  if (options.make) query.set('make', options.make);
  if (options.vehicleClass) query.set('vehicleClass', options.vehicleClass);
  if (options.surfaceType) query.set('surfaceType', options.surfaceType);
  if (options.locationTag) query.set('locationTag', options.locationTag);
  if (options.tag) query.set('tag', options.tag);
  if (options.sortBy) query.set('sortBy', options.sortBy);

  const qs = query.toString();
  const path = qs ? `/api/garage/feed?${qs}` : '/api/garage/feed';

  return apiJson<PaginatedFeedResponse>(path, {
    method: 'GET',
    token,
  });
}

/**
 * Purpose: atomically toggle star/like endorsement on a setup sheet.
 */
export function apiToggleLike(
  setupId: string,
  token: string,
): Promise<LikeToggleResult> {
  return apiJson<LikeToggleResult>(
    `/api/garage/setups/${encodeURIComponent(setupId)}/like`,
    {
      method: 'POST',
      token,
    },
  );
}
