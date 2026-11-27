import { test, expect, login } from './fixtures.mjs';

test('G1 · la liste ouvre le détail et conserve la sélection globale', async ({ page }) => {
  await login(page);
  await page.goto('/groups');
  await expect(page.getByRole('heading', { name: 'Mes groupes' })).toBeVisible();
  const card = page.locator('app-ui-group-card').filter({ hasText: 'Famille recette' }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('#group-detail')).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Aperçu' })).toBeVisible();
  await page.getByRole('tab', { name: 'Aperçu' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Membres' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Membres' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'group-tab-members');
  if (page.viewportSize().width < 1024) {
    await page.getByRole('button', { name: /Retour aux groupes/ }).filter({ visible: true }).click();
    await expect(card.locator('button')).toBeFocused();
  }
  await page.reload();
  await expect(page.locator('app-ui-group-card').filter({ hasText: 'Famille recette' }).first()).toBeVisible();
});

test('G1 · créer un groupe reste un parcours distinct de la consultation', async ({ page }) => {
  await login(page);
  await page.goto('/groups');
  await expect(page.locator('input[name=groupName]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Créer un groupe' }).filter({ visible: true }).first().click();
  await expect(page.locator('input[name=groupName]')).toBeVisible();
  await expect(page.getByText('La devise sera verrouillée après la première opération.')).toBeVisible();
});

test('G1 · un nouveau membre peut créer ou rejoindre depuis la page vide', async ({ page }) => {
  const address = `groups-${crypto.randomUUID()}@example.invalid`;
  const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
  const created = await fetch(`${authUrl}/accounts:signUp?key=demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, password: 'Only-in-local-emulators-123' }) });
  expect(created.ok).toBeTruthy();
  const { localId } = await created.json();
  const verified = await fetch(`${authUrl}/accounts:update?key=demo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ localId, emailVerified: true }) });
  expect(verified.ok).toBeTruthy();
  await page.goto('/login');
  await page.locator('#login-email').fill(address);
  await page.locator('#login-password').fill('Only-in-local-emulators-123');
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/groups');
  await expect(page.locator('input[name=groupName]')).toBeVisible();
  await expect(page.locator('#groups-empty-invite-link')).toBeVisible();
});

test('G1 · le lien d’export ouvre le compte avec le groupe demandé', async ({ page }) => {
  await login(page);
  await page.goto('/account?exportGroup=voyage#export-history');
  await expect(page.locator('app-export-panel #exportGroup')).toContainText('Voyage recette');
});
