// Integration tests: *.int-spec.ts, the real Nest app over HTTP (supertest)
// against the quacker_test database. Unit tests (*.spec.ts) use the "jest"
// block in package.json; neither config picks up the other's files.
//
// Unlike the unit tests, these load the whole AppModule, so they pull in
// BetterAuth and its dependencies, which ship as ES modules only. Jest runs
// CommonJS, so those files are transpiled too (transpile-only, no type check).
/** @type {import('jest').Config} */
module.exports = {
  rootDir: './',
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json', 'ts', 'tsx'],
  moduleDirectories: ['node_modules'],
  testRegex: '\\.int-spec\\.ts$',
  transform: {
    // Our code, including the .tsx email templates: type-checked like the unit tests
    '^.+\\.tsx?$': 'ts-jest',
    // ES-module dependencies → CommonJS
    '^.+\\.m?js$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: { allowJs: true, module: 'commonjs' },
      },
    ],
  },
  // Transform .mjs everywhere and .js inside ESM-only packages; leave the rest.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/)?(better-auth|@better-auth|better-call|@better-fetch|jose|nanostores|rou3|defu|uncrypto|@noble|kysely)).+\\.c?js$',
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/src/test/integration/global-setup.ts',
  setupFiles: [
    '<rootDir>/src/test/integration/env.ts',
    '<rootDir>/src/test/integration/mocks.ts',
  ],
  testTimeout: 30000,
};
