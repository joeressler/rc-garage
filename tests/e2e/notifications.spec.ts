/**
 * Milestone 20 live runner. Nest-booted coverage lives in backend/test/notifications.e2e.ts.
 */
import { applyE2eHardeningEnv } from '../../backend/test/e2e-env';
import { runNotificationsVerification } from '../../backend/test/notifications.e2e';

export { runNotificationsVerification };

async function main(): Promise<void> {
  applyE2eHardeningEnv();
  if (process.env.TEST_BASE_URL) {
    console.log(`[Notifications] Executing live against ${process.env.TEST_BASE_URL}...`);
    throw new Error(
      'Live TEST_BASE_URL notifications runner requires a DatabaseService handle; boot Nest via backend/test/notifications.e2e.ts instead.',
    );
  }
  console.log(
    '[Notifications] TEST_BASE_URL not set; spec ready for execution against a local Nest boot (backend/test/notifications.e2e.ts).',
  );
}

const notificationsEntry = (process.argv[1] ?? '').replace(/\\/g, '/');
if (
  notificationsEntry.endsWith('tests/e2e/notifications.spec.ts') ||
  notificationsEntry.endsWith('tests/e2e/notifications.spec.js')
) {
  main().catch((error) => {
    console.error('Milestone 20 notifications verification failed:', error);
    process.exit(1);
  });
}
