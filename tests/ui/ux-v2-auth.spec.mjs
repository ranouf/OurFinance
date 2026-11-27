import { test, expect } from '@playwright/test';

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
