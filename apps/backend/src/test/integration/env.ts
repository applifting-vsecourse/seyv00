import { assertTestDatabase, TEST_DATABASE_URL } from './test-database';

// Runs in every test file before the app is created. Set everything the
// Config class needs here instead of reading apps/backend/.env, which points
// at the dev database.
assertTestDatabase(TEST_DATABASE_URL);

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET = 'integration_test_secret';
process.env.SUPERADMIN_EMAIL = 'admin@example.com';
process.env.SUPERADMIN_PASSWORD = 'adminpassword';
process.env.BACKEND_URL = 'http://localhost:4050';
process.env.FRONTEND_URL = 'http://localhost:3050';
// No mail provider: verification emails go to the console adapter.
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_HOST;
