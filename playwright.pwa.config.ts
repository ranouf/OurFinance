import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pwa',
  globalSetup: './tests/ui/seed.mjs',
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5000',
    browserName: 'chromium',
    serviceWorkers: 'allow',
    locale: 'fr-CA',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    { name: 'pwa-mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'pwa-desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
