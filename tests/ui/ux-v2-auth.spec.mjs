import { test, expect, login } from './fixtures.mjs';

const fictionalToken = 'a'.repeat(43);

test('connexion et récupération gardent des champs accessibles', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Bienvenue/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Adresse courriel/i })).toBeVisible();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Mot de passe oublié/i }).click();
  await expect(page.getByRole('heading', { name: /Réinitialiser le mot de passe/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Adresse courriel/i })).toBeVisible();
});

test('une invitation fictive est capturée avant affichage puis conservée pendant le choix de connexion', async ({ page }) => {
  await page.goto(`/join#invite=${fictionalToken}`);
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole('heading', { name: /Un groupe vous attend/i })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('ourfinance.pendingInvite'))).toBe(fictionalToken);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('textbox', { name: /Adresse courriel/i })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('ourfinance.pendingInvite'))).toBe(fictionalToken);
});

test('un second lien mal formé efface le premier sans exposer son jeton dans la route', async ({ page }) => {
  await page.goto(`/join#invite=${fictionalToken}`);
  await expect(page.getByRole('heading', { name: /Un groupe vous attend/i })).toBeVisible();
  await page.evaluate(() => { location.hash = '#invite=bad'; });
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByText(/lien d’invitation n’est pas valide/i)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('ourfinance.pendingInvite'))).toBeNull();
});

test('le stockage bloqué présente une erreur sans laisser le fragment visible', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', {
    get() { throw new DOMException('blocked', 'SecurityError'); },
  }));
  await page.goto(`/join#invite=${fictionalToken}`);
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByText(/stockage de cet onglet est désactivé/i)).toBeVisible();
});

test('un ancien aperçu ne remplace pas celui du nouveau lien', async ({ page }) => {
  await login(page);
  const pending = new Map();
  await page.route('https://worker.invalid/qr-invitations/preview', route => {
    const token = route.request().postDataJSON().token;
    pending.set(token, route);
  });
  const oldToken = 'a'.repeat(43);
  const newToken = 'b'.repeat(43);
  await page.goto(`/join#invite=${oldToken}`);
  await expect.poll(() => pending.has(oldToken)).toBe(true);
  await page.evaluate(token => { location.hash = `#invite=${token}`; }, newToken);
  await expect.poll(() => pending.has(newToken)).toBe(true);
  await pending.get(oldToken).fulfill({ json: { groupName: 'Ancien groupe', currency: 'CAD', expiresAt: '2030-01-01T00:00:00Z' } });
  await expect(page.getByText('Ancien groupe')).toHaveCount(0);
  await pending.get(newToken).fulfill({ json: { groupName: 'Nouveau groupe', currency: 'CAD', expiresAt: '2030-01-01T00:00:00Z' } });
  await expect(page.getByRole('heading', { name: 'Nouveau groupe' })).toBeVisible();
});
