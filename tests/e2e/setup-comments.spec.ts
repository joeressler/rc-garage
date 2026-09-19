/**
 * Milestone 19 live runner. Nest-booted coverage lives in backend/test/comments.e2e.ts.
 */
import { applyE2eHardeningEnv } from '../../backend/test/e2e-env';
import { runSetupCommentsVerification } from '../../backend/test/comments.e2e';

export { runSetupCommentsVerification };

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  if (process.env.TEST_BASE_URL) {
    console.log(`[Setup Comments] Executing live against ${process.env.TEST_BASE_URL}...`);
    throw new Error(
      'Live TEST_BASE_URL setup-comments runner requires a DatabaseService handle; boot Nest via backend/test/comments.e2e.ts instead.',
    );
  }
  console.log(
    '[Setup Comments] TEST_BASE_URL not set; spec ready for execution against a local Nest boot (backend/test/comments.e2e.ts).',
  );
}

const setupCommentsEntry = (process.argv[1] ?? '').replace(/\\/g, '/');
if (
  setupCommentsEntry.endsWith('tests/e2e/setup-comments.spec.ts') ||
  setupCommentsEntry.endsWith('tests/e2e/setup-comments.spec.js')
) {
  main().catch((error) => {
    console.error('Milestone 19 setup-comments verification failed:', error);
    process.exit(1);
  });
}
