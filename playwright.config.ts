import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3187', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3187/ko/login',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
