/**
 * Milestone 15 live runner. Nest-booted coverage lives in backend/test/auth-lifecycle.spec.ts.
 */
import { runAuthLifecycleVerification } from '../../backend/test/auth-lifecycle.spec';

export { runAuthLifecycleVerification };

async function main(): Promise<void> {
  if (process.env.TEST_BASE_URL) {
    console.log(`[Auth Lifecycle] Executing live against ${process.env.TEST_BASE_URL}...`);
    await runAuthLifecycleVerification(process.env.TEST_BASE_URL);
    return;
  }
  console.log(
    '[Auth Lifecycle] TEST_BASE_URL not set; spec ready for execution against a live test server.',
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Milestone 15 Verification Failed:', error);
    process.exit(1);
  });
}
