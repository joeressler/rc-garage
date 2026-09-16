/**
 * Purpose: verify chassis QR payload URLs strip trailing slashes and default the SPA origin.
 */
import {
  buildChassisInspectionUrl,
  normalizeAppBaseUrl,
} from '../src/modules/qr/utils/qr-url.util';

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

function main(): void {
  assert(
    normalizeAppBaseUrl(undefined) === 'http://127.0.0.1:3742',
    'missing APP_BASE_URL should default to loopback SPA origin',
  );
  assert(
    normalizeAppBaseUrl('https://rc-garage.community/') ===
      'https://rc-garage.community',
    'trailing slash should be stripped from APP_BASE_URL',
  );
  assert(
    buildChassisInspectionUrl('https://rc-garage.community/', 'v9k2pq1x8m') ===
      'https://rc-garage.community/s/v9k2pq1x8m',
    'sticker payload must be origin plus /s/:slug',
  );
  console.log('qr url util: all acceptance checks passed');
}

main();
