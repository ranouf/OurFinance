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

test('A2 · le lien de réinitialisation remplace réellement le mot de passe', async ({ page, request }, testInfo) => {
  const address = `reset-${testInfo.project.name}@example.invalid`;
  const authApi = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/';
  const signup = await request.post(authApi + 'accounts:signUp?key=demo', {
    data: { email: address, password },
  });
  expect(signup.ok()).toBe(true);
  const { localId } = await signup.json();
  const verified = await request.post(authApi + 'accounts:update?key=demo', {
    headers: { Authorization: 'Bearer owner' },
    data: { localId, emailVerified: true },
  });
  expect(verified.ok()).toBe(true);
  const oldPassword = password;
  const newPassword = 'Only-in-local-emulators-456';

  await page.goto('/login');
  await page.getByRole('button', { name: 'Mot de passe oublié' }).click();
  await page.locator('#login-email').fill(address);
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  await expect(page.getByText('Si ce compte existe, un courriel sera envoyé.')).toBeVisible();

  let resetCode;
  await expect.poll(async () => {
    const inbox = await request.get(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`);
    expect(inbox.ok()).toBe(true);
    resetCode = (await inbox.json()).oobCodes?.find(message =>
      message.email === address && message.requestType === 'PASSWORD_RESET')?.oobCode;
    return Boolean(resetCode);
  }).toBe(true);
  const applied = await request.post(authApi + 'accounts:resetPassword?key=demo', {
    data: { oobCode: resetCode, newPassword },
  });
  expect(applied.ok()).toBe(true);
  const replay = await request.post(authApi + 'accounts:resetPassword?key=demo', {
    data: { oobCode: resetCode, newPassword: 'Only-in-local-emulators-789' },
  });
  expect(replay.ok()).toBe(false);

  const oldLogin = await request.post(authApi + 'accounts:signInWithPassword?key=demo', {
    data: { email: address, password: oldPassword, returnSecureToken: true },
  });
  expect(oldLogin.ok()).toBe(false);
  const newLogin = await request.post(authApi + 'accounts:signInWithPassword?key=demo', {
    data: { email: address, password: newPassword, returnSecureToken: true },
  });
  expect(newLogin.ok()).toBe(true);
  await page.getByRole('button', { name: 'Connexion', exact: true }).click();
  await page.locator('#login-email').fill(address);
  await page.locator('#login-password').fill(newPassword);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
