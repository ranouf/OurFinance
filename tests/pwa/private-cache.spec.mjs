import { test, expect } from '@playwright/test';
import { email, password } from '../ui/seed.mjs';

test('la PWA de production sert le shell hors ligne sans exposer le groupe après déconnexion', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __FIREBASE_DEFAULTS__: {
      emulatorHosts: { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' },
    } });
  });
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Famille recette', { exact: true }).filter({ visible: true }).first()).toBeVisible();

  await expect.poll(async () => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');
  const cacheKeys = await page.evaluate(async () => caches.keys());
  expect(cacheKeys.some(key => key.startsWith('ngsw:'))).toBe(true);
  const cachedRequests = await page.evaluate(async () => (await Promise.all(
    (await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)),
  )).flat());
  expect(cachedRequests.some(url => /firestore|identitytoolkit|\/groups\/|\/receipts\//.test(url))).toBe(false);

  await page.locator('app-shell header details summary').click();
  await page.getByRole('button', { name: /déconnexion/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await context.setOffline(true);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Famille recette', { exact: true })).toHaveCount(0);
  await context.setOffline(false);
  await page.locator('#login-email').fill('alex@example.invalid');
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/groups');
  await expect(page.locator('app-ui-group-card')).toHaveCount(1);
  await expect(page.getByText('Voyage recette', { exact: true })).toHaveCount(0);
});
