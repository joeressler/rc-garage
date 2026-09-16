const DEFAULT_APP_BASE_URL = 'http://127.0.0.1:3742';

/**
 * Purpose: canonicalize the public SPA origin used inside chassis QR payloads.
 */
export function normalizeAppBaseUrl(baseUrl: string | undefined): string {
  const trimmed = (baseUrl ?? DEFAULT_APP_BASE_URL).trim();
  const withoutSlash = trimmed.replace(/\/+$/, '');
  return withoutSlash.length > 0 ? withoutSlash : DEFAULT_APP_BASE_URL;
}

/**
 * Purpose: encode the unauthenticated pit-inspection short URL that vinyl stickers scan to.
 */
export function buildChassisInspectionUrl(
  baseUrl: string | undefined,
  slug: string,
): string {
  return `${normalizeAppBaseUrl(baseUrl)}/s/${slug}`;
}
