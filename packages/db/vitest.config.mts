import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The row-level-security tests talk to a real Postgres: policies cannot be
    // proved against a mock. Start the local stack first:
    //   docker compose -f infra/docker/docker-compose.yml up -d
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/**/*.spec.ts'],
    // One database, shared state: keep the files sequential.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
