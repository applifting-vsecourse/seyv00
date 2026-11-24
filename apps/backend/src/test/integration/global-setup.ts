import { execSync } from 'child_process';
import { assertTestDatabase, TEST_DATABASE_URL } from './test-database';

/**
 * Runs once before all integration tests: brings the test database up to the
 * schema in prisma/migrations. `migrate deploy` creates the database if it
 * doesn't exist yet.
 */
export default function globalSetup(): void {
  assertTestDatabase(TEST_DATABASE_URL);
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
