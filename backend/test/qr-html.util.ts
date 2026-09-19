/**
 * Purpose: verify crawler share HTML escapes user strings and sitemap XML stays bounded.
 */
import {
  buildShareHtml,
  buildShareNotFoundHtml,
  buildSitemapXml,
  escapeHtml,
  formatShareDescription,
  SITEMAP_SETUP_URL_LIMIT,
  SITEMAP_STATIC_PATHS,
  SITEMAP_URL_CAP,
} from '../src/modules/qr/qr-html.util';

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

function main(): void {
  assert(SITEMAP_URL_CAP === 10_000, 'v1 sitemap cap is 10,000 URLs');
  assert(SITEMAP_STATIC_PATHS.length === 5, 'static sitemap locs are five routes');
  assert(
    SITEMAP_SETUP_URL_LIMIT === SITEMAP_URL_CAP - SITEMAP_STATIC_PATHS.length,
    'setup rows must leave room for static locs',
  );

  assert(
    escapeHtml(`<img src=x onerror=alert(1)> & "quoted"`) ===
      '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot;',
    'HTML special characters must be escaped',
  );

  const description = formatShareDescription('Vanquish', 'VS4-10 Phoenix', 10.8, 59.2);
  assert(
    description === 'Vanquish VS4-10 Phoenix · FDR 10.80 · Front CoG 59.2%',
    `share description should include FDR and CoG, got ${description}`,
  );

  const html = buildShareHtml({
    setupId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    title: 'Moab <script>alert(1)</script> Spec',
    callsign: 'Trail&Boss',
    make: 'Element',
    model: 'Enduro Sendero HD',
    calculatedFdr: 10.03,
    frontBiasPercentage: 60,
    canonicalUrl: 'https://rc-garage.community/s/v9k2pq1x8m',
    ogImageUrl:
      'https://rc-garage.community/api/garage/setups/cccccccc-cccc-4ccc-8ccc-cccccccccccc/qr?format=png&size=512',
  });

  assert(
    html.includes(
      '<meta property="og:title" content="Moab &lt;script&gt;alert(1)&lt;/script&gt; Spec"',
    ),
    'og:title must use the escaped setup title as the content value',
  );
  assert(
    !html.includes('<script>alert(1)</script>'),
    'raw script tags from titles must not survive interpolation',
  );
  assert(
    html.includes('format=png&amp;size=512'),
    'og:image query ampersand must be escaped',
  );
  assert(
    html.includes(
      'content="https://rc-garage.community/api/garage/setups/cccccccc-cccc-4ccc-8ccc-cccccccccccc/qr?format=png&amp;size=512"',
    ),
    'og:image must remain an absolute http(s) QR PNG URL',
  );
  assert(
    html.includes("location.replace('/feed?inspect=' + encodeURIComponent("),
    'human browsers must JS-replace onto /feed?inspect=, not /s/',
  );
  assert(!html.includes('http-equiv="refresh"'), 'meta refresh is forbidden for crawlers');

  const missing = buildShareNotFoundHtml();
  assert(
    missing.includes('<meta name="robots" content="noindex"'),
    '404 HTML must be noindex',
  );
  assert(
    !missing.includes('Moab'),
    '404 HTML must not leak the hidden setup title',
  );

  const sitemap = buildSitemapXml([
    { loc: 'http://127.0.0.1:3742/' },
    { loc: 'http://127.0.0.1:3742/s/v9k2pq1x8m', lastmod: '2026-09-19T00:00:00.000Z' },
    { loc: 'http://127.0.0.1:3742/s/<bad>' },
  ]);
  assert(sitemap.includes('<loc>http://127.0.0.1:3742/s/v9k2pq1x8m</loc>'), 'sitemap lists slug locs');
  assert(
    sitemap.includes('<lastmod>2026-09-19T00:00:00.000Z</lastmod>'),
    'sitemap lastmod comes from updated_at',
  );
  assert(
    sitemap.includes('<loc>http://127.0.0.1:3742/s/&lt;bad&gt;</loc>'),
    'sitemap locs must be XML-escaped',
  );

  const overflow = Array.from({ length: SITEMAP_URL_CAP + 25 }, (_, index) => ({
    loc: `http://127.0.0.1:3742/s/${index}`,
  }));
  const capped = buildSitemapXml(overflow);
  const locCount = (capped.match(/<loc>/g) ?? []).length;
  assert(locCount === SITEMAP_URL_CAP, `sitemap must cap at ${SITEMAP_URL_CAP}, got ${locCount}`);

  console.log('qr html util: all acceptance checks passed');
}

main();
