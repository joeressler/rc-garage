import { z } from 'zod';
import { FeedItem } from './feed.contract';

export const CallsignParamSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Callsign must be alphanumeric');

/**
 * Purpose: treat blank profile query-string values as omitted pagination.
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

function normalizeProfileQuery(value: unknown): Record<string, unknown> {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};

  return {
    cursor: blankToUndefined(source.cursor),
    limit: blankToUndefined(source.limit),
  };
}

export const ProfileQuerySchema = z.preprocess(
  normalizeProfileQuery,
  z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
);

export type ProfileQueryDto = z.infer<typeof ProfileQuerySchema>;

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
