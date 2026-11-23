import { test, expect } from './fixtures.mjs';
import { password, projectId } from './seed.mjs';

test('A1/P1 · inscription, vérification du courriel local et préférences persistantes', async ({ page, request }, testInfo) => {
  const email = testInfo.project.name + '@example.invalid';
  await page.goto('/login');
  await page.getByRole('button', { name: 'Inscription', exact: true }).click();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type=submit]').click();
  const confirmed = page.getByRole('button', { name: 'J’ai confirmé mon adresse' });
  await expect(confirmed).toBeVisible();
  let code;
  await expect.poll(async () => {
    const inbox = await request.get('http://127.0.0.1:9099/emulator/v1/projects/' + projectId + '/oobCodes');
    const messages = (await inbox.json()).oobCodes ?? [];
    code = messages.find(message => message.email === email && message.requestType === 'VERIFY_EMAIL')?.oobCode;
    return Boolean(code);
  }).toBe(true);
  const applied = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo', { data: { oobCode: code } });
  expect(applied.ok()).toBe(true);
  await confirmed.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/account');
  const profile = page.locator('app-profile-panel');
  const name = profile.locator('[name=profileName]');
  await name.fill('Camille du test');
  await profile.locator('#profile-language').click();
  await profile.getByRole('option', { name: '日本語' }).click();
  await profile.locator('button[type=submit]').click();
  await expect(profile.getByRole('status').first()).toBeVisible();
  await page.reload();
  await expect(name).toHaveValue('Camille du test');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});
