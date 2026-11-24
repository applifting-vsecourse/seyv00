// No `@/` imports here: Jest's globalSetup doesn't go through moduleNameMapper.

/**
 * The integration tests' own database in the Docker Postgres from
 * `pnpm dev` (port 5433). CI runs a Postgres service on the same port with the
 * same credentials, so the default works there too. Override with
 * TEST_DATABASE_URL.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quacker:quacker@localhost:5433/quacker_test';

/**
 * The tests truncate every table before each test. Refuse anything whose
 * database name doesn't end in `_test`, so a stray DATABASE_URL can never wipe
 * the dev database.
 */
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(
      `Integration tests only run against a database whose name ends in "_test", got "${name}".`,
    );
  }
}
