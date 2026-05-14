import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests-e2e',
  timeout: 90_000,
  webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5173' },
});
