import { test, expect, login } from './fixtures.mjs';

test('D1 · les filtres actifs sont visibles et peuvent être effacés', async ({ page }) => {
  await login(page);
  await page.goto('/expenses');
  const history = page.locator('app-expense-history');
  await expect(history.getByText('Repas de recette')).toBeVisible();
  await history.getByRole('searchbox', { name: 'Rechercher dans tout l’historique' }).fill('inexistant');
  await history.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(history.getByRole('button', { name: 'Retirer le filtre Rechercher' })).toBeVisible();
  await expect(history.getByText('Repas de recette')).toHaveCount(0);
  await history.getByRole('button', { name: 'Retirer le filtre Rechercher' }).click();
  await expect(history.getByText('Repas de recette')).toBeVisible();
  await history.getByRole('searchbox', { name: 'Rechercher dans tout l’historique' }).fill('inexistant');
  await history.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await history.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
  await expect(history.getByRole('button', { name: 'Retirer le filtre Rechercher' })).toHaveCount(0);
  await expect(history.getByText('Repas de recette')).toBeVisible();
});

test('D4 · le bouton mobile ne masque pas la dernière ligne de l’historique', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1280, 'CTA fixe réservé aux écrans étroits');
  await login(page);
  await page.goto('/expenses');
  const lastExpense = page.locator('app-expense-history li[id^="expense-"]').last();
  const addButton = page.getByRole('button', { name: /Ajouter une dépense/ });
  await expect(lastExpense).toBeVisible();
  await expect(addButton).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const expenseBounds = await lastExpense.boundingBox();
  const buttonBounds = await addButton.boundingBox();
  expect(expenseBounds && buttonBounds).toBeTruthy();
  expect(expenseBounds.y + expenseBounds.height).toBeLessThan(buttonBounds.y);
});
