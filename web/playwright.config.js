import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
