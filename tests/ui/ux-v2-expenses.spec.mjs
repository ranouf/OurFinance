import { test, expect, login } from './fixtures.mjs';

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
