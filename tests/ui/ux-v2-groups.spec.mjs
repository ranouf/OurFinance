import { test, expect, login } from './fixtures.mjs';

test('G1 · la liste ouvre le détail et conserve la sélection globale', async ({ page }) => {
  await login(page);
  await page.goto('/groups');
  await expect(page.getByRole('heading', { name: 'Mes groupes' })).toBeVisible();
  const card = page.locator('app-ui-group-card').filter({ hasText: 'Famille recette' }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('tab', { name: 'Aperçu' })).toBeVisible();
  await page.getByRole('tab', { name: 'Aperçu' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Membres' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Membres' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'group-tab-members');
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
