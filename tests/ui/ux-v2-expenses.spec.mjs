import { test, expect, login } from './fixtures.mjs';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createExpense, ExpenseError } from '../../workers/ourfinance-api/src/expenses';

test('D2 · le formulaire écrit une dépense via la transaction Worker et Firestore émulé', async ({ page }) => {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  expect(emulator).toBeTruthy();
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'ui@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const transport = async (resource, init) => {
    const url = String(resource);
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'emulator-only' });
    if (!url.startsWith('https://firestore.googleapis.com/v1/')) throw new Error(`Unexpected provider: ${url}`);
    return fetch(url.replace('https://firestore.googleapis.com/v1/', `http://${emulator}/v1/`), { ...init, headers: { ...init?.headers, Authorization: 'Bearer owner' } });
  };
  await page.route('https://worker.invalid/groups/*/expenses', async route => {
    const token = route.request().headers()['authorization']?.replace(/^Bearer /, '');
    const auth = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
    });
    const uid = (await auth.json()).users?.[0]?.localId;
    expect(uid).toBeTruthy();
    try {
      const expenseId = await createExpense(route.request().postDataJSON(), uid, 'famille', env, transport);
      await route.fulfill({ status: 201, json: { expenseId } });
    } catch (error) {
      if (!(error instanceof ExpenseError)) throw error;
      await route.fulfill({ status: error.status, json: { error: error.code } });
    }
  });
  await login(page);
  await page.goto('/expenses?action=add');
  const form = page.locator('app-expense-form');
  const description = `Repas intégré ${crypto.randomUUID().slice(0, 8)}`;
  await form.locator('[name=description]').fill(description);
  await form.locator('[name=amount]').fill('10.01');
  await form.getByRole('button', { name: 'Enregistrer la dépense' }).click();
  await expect(page.locator('app-expense-history').getByText(description)).toBeVisible();
});

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
