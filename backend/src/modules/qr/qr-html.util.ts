import {
  ShareHtmlFields,
  SitemapUrlEntry,
} from '../../contracts/qr.contract';

/**
 * Purpose: cap a single sitemap so hobby-volume public sheets stay in one file.
 * Typical garage inventories are far below this; do not add sitemap indexes in v1.
 */
export const SITEMAP_URL_CAP = 10_000;

export const SITEMAP_STATIC_PATHS = [
  '/',
  '/feed',
  '/legal/terms',
  '/legal/privacy',
  '/legal/guidelines',
] as const;

export const SITEMAP_SETUP_URL_LIMIT =
  SITEMAP_URL_CAP - SITEMAP_STATIC_PATHS.length;

/**
 * Purpose: prevent user-controlled setup titles from breaking out of HTML/XML tags.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatShareDescription(
  make: string,
  model: string,
  calculatedFdr: number,
  frontBiasPercentage: number,
): string {
  return `${make} ${model} · FDR ${calculatedFdr.toFixed(2)} · Front CoG ${frontBiasPercentage.toFixed(1)}%`;
}

export function formatSitemapLastmod(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
}

export function buildShareHtml(fields: ShareHtmlFields): string {
  const title = escapeHtml(fields.title);
  const description = escapeHtml(
    formatShareDescription(
      fields.make,
      fields.model,
      fields.calculatedFdr,
      fields.frontBiasPercentage,
    ),
  );
  const documentTitle = escapeHtml(
    `${fields.title} — @${fields.callsign} | RC Garage`,
  );
  const canonicalUrl = escapeHtml(fields.canonicalUrl);
  const ogImageUrl = escapeHtml(fields.ogImageUrl);
  const inspectHref = `/feed?inspect=${encodeURIComponent(fields.setupId)}`;
  const inspectHrefAttr = escapeHtml(inspectHref);
  const setupIdJs = JSON.stringify(fields.setupId);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${documentTitle}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
</head>
<body>
  <noscript>
    <h1>${title}</h1>
    <p>${description}</p>
    <p><a href="${inspectHrefAttr}">Open in Pit-Mat Workbench</a></p>
  </noscript>
  <p><a href="${inspectHrefAttr}">Open in Pit-Mat Workbench</a></p>
  <script>location.replace('/feed?inspect=' + encodeURIComponent(${setupIdJs}));</script>
</body>
</html>
`;
}

/**
 * Purpose: 404 HTML for private/hidden/unknown slugs must not leak the sheet title.
 */
export function buildShareNotFoundHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex" />
  <title>Setup not found | RC Garage</title>
</head>
<body>
  <p>This setup sheet is not public.</p>
</body>
</html>
`;
}

export function buildSitemapXml(entries: SitemapUrlEntry[]): string {
  const capped = entries.slice(0, SITEMAP_URL_CAP);
  const urls = capped
    .map((entry) => {
      const loc = escapeHtml(entry.loc);
      const lastmod = entry.lastmod
        ? `\n    <lastmod>${escapeHtml(entry.lastmod)}</lastmod>`
        : '';
      return `  <url>\n    <loc>${loc}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
