import { test, expect, login } from './fixtures.mjs';

test('D2 · les cinq répartitions respectent les centimes de l’oracle', async ({ page }) => {
  await login(page);
  await page.goto('/expenses?action=add');
  const form = page.locator('app-expense-form');
  await expect(form.locator('#group')).toContainText('Famille recette');
  await form.locator('[name=amount]').fill('10.01');
  await form.locator('[name=description]').fill('Repas à partager');
  const members = form.getByRole('checkbox', { name: /^(Moi|Autre membre)/ });
  await expect(members).toHaveCount(2);
  for (const [label, values, cents] of [
    ['Égalitaire', [], [500, 501]],
    ['Montants exacts', ['4.00', '6.01'], [400, 601]],
    ['Pourcentages', ['40', '60'], [400, 601]],
    ['Parts', ['1', '2'], [334, 667]],
    ['Ajustements', ['1', '-1'], [400, 601]],
  ]) {
    await form.locator('#expense-split-mode').click();
    await form.getByRole('option', { name: label, exact: true }).click();
    for (const member of await members.all()) await member.check();
    const inputs = form.locator('input[aria-label][inputmode=decimal]').filter({ visible: true });
    for (const [i, value] of values.entries()) await inputs.nth(i).fill(value);
    await form.getByRole('button', { name: /Calculer les parts/ }).click();
    const rows = form.getByRole('list', { name: /Parts calculées/ }).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    const amounts = (await rows.allTextContents()).map(row => {
      const amount = row.match(/:\s*(\d+)[,.](\d{2})/);
      expect(amount, label).toBeTruthy();
      return Number(amount[1]) * 100 + Number(amount[2]);
    });
    // Un centime résiduel suit l’ordre canonique des identifiants.
    if (label === 'Ajustements') expect([[401, 600], cents]).toContainEqual(amounts.sort((a,b) => a-b));
    else expect(amounts.sort((a,b) => a-b)).toEqual(cents);
  }
});

test('I1 · ouvrir un lien puis refuser laisse le groupe intact', async ({ page }) => {
  await login(page);
  const calls = [];
  await page.route('https://worker.invalid/qr-invitations/**', async route => {
    calls.push(new URL(route.request().url()).pathname);
    await route.fulfill({ json: { groupName: 'Groupe invité', currency: 'CAD', expiresAt: '2030-01-01T12:00:00Z' } });
  });
  await page.goto('/join#invite=' + 'x'.repeat(43));
  const card = page.locator('app-invite-acceptance-card');
  await expect(card.getByRole('heading', { name: 'Groupe invité' })).toBeVisible();
  await card.getByRole('button', { name: /Pas maintenant/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(calls).toEqual(['/qr-invitations/preview']);
});

test('G2/M3 · un membre révoqué du voyage ne peut ni le lire ni restaurer la famille', async ({ page }) => {
  await login(page, 'alex@example.invalid');
  await page.goto('/groups');
  const cards = page.locator('app-ui-group-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Famille recette');
  await page.goto('/account');
  const restore = page.locator('app-restore-panel');
  await expect(restore).toContainText(/propriétaire/i);
  await expect(restore.locator('input[type=file]')).toHaveCount(0);
});
