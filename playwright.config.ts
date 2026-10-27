import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3188', trace: 'retain-on-failure' },
  webServer: {
    command: 'npx next dev --hostname 127.0.0.1 --port 3188',
    url: 'http://127.0.0.1:3188/ko/login',
    env: { PODUNG_E2E: '1', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3188' },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
