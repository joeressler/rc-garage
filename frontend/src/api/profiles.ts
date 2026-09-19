import { apiJson } from './http';
import type { FeedItem } from './feed';

export interface PublicDriverProfile {
  callsign: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  publicSetupCount: number;
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PublicProfileQuery {
  cursor?: string;
  limit?: number;
}

/**
 * Purpose: load a public driver garage of non-hidden public setup sheets by callsign.
 */
export function apiGetPublicProfile(
  callsign: string,
  query: PublicProfileQuery = {},
  token?: string | null,
): Promise<PublicDriverProfile> {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();
  const path = qs
    ? `/api/garage/profiles/${encodeURIComponent(callsign)}?${qs}`
    : `/api/garage/profiles/${encodeURIComponent(callsign)}`;

  return apiJson<PublicDriverProfile>(path, {
    method: 'GET',
    token,
  });
}
