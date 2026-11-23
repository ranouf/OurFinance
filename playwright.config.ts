import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  globalSetup: './tests/ui/seed.mjs',
  workers: 2,
  retries: 0,
  use: { actionTimeout: 10000, navigationTimeout: 15000, baseURL: 'http://127.0.0.1:4207', serviceWorkers: 'block', locale: 'fr-CA' },
  projects: [
    { name: 'petit-mobile', use: { viewport: { width: 320, height: 740 }, hasTouch: true } },
    { name: 'tablette', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npm start -- --host 127.0.0.1 --port 4207',
    url: 'http://127.0.0.1:4207', timeout: 120000, reuseExistingServer: false,
  },
});
