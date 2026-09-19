/**
 * Milestone 16 live runner. Nest-booted coverage lives in backend/test/content-reports.spec.ts.
 */
import { applyE2eHardeningEnv } from '../../backend/test/e2e-env';
import { runContentReportsVerification } from '../../backend/test/hardening-reports.spec';

export { runContentReportsVerification };

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  if (process.env.TEST_BASE_URL) {
    console.log(`[Content Reports] Executing live against ${process.env.TEST_BASE_URL}...`);
    throw new Error(
      'Live TEST_BASE_URL content-reports runner requires a DatabaseService handle; boot Nest via backend/test/content-reports.spec.ts instead.',
    );
  }
  console.log(
    '[Content Reports] TEST_BASE_URL not set; spec ready for execution against a local Nest boot (backend/test/content-reports.spec.ts).',
  );
}

const contentReportsEntry = (process.argv[1] ?? '').replace(/\\/g, '/');
if (
  contentReportsEntry.endsWith('tests/e2e/content-reports.spec.ts') ||
  contentReportsEntry.endsWith('tests/e2e/content-reports.spec.js')
) {
  main().catch((error) => {
    console.error('Milestone 16 content-reports verification failed:', error);
    process.exit(1);
  });
}
