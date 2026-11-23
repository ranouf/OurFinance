import { test as base, expect } from '@playwright/test';
import { email, password, projectId } from './seed.mjs';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      Object.assign(window, { __FIREBASE_DEFAULTS__: {
        emulatorHosts: { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' },
      } });
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (url.pathname === '/app-config.json') return route.fulfill({ json: {
        projectId, apiKey: 'demo', appId: 'demo', authDomain: 'localhost',
        workerUrl: 'https://worker.invalid',
      } });
      return route.continue();
    });
    await use(page);
  },
});
export { expect };
export async function login(page, address = email, expectedGroup = 'Famille recette') {
  await page.goto('/login');
  await page.locator('#login-email').fill(address);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(expectedGroup, { exact: true }).filter({ visible: true }).first()).toBeVisible();
}

