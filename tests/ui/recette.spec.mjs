import { test, expect, login } from './fixtures.mjs';

test('A1/A2 · validation de la connexion et protection des liens privés', async ({ page }) => {
  for (const route of ['dashboard', 'groups', 'expenses', 'statistics', 'account']) {
    await page.goto('/' + route);
    await expect(page).toHaveURL(/\/login$/);
  }
  await page.locator('form button[type=submit]').click();
  await expect(page.locator('#login-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#login-email-error')).toBeVisible();
  await page.getByRole('button', { name: 'Mot de passe oublié' }).click();
  await expect(page.locator('#login-password')).toHaveCount(0);
});

test('I1 · une invitation incomplète ne déclenche aucune adhésion', async ({ page }) => {
  const mutations = [];
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('worker.invalid')) mutations.push(r.url()); });
  await page.goto('/join#invite=abc');
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByText(/lien d’invitation n’est pas valide/i)).toBeVisible();
  await expect(page.locator('#login-email')).toHaveCount(0);
  expect(mutations).toEqual([]);
});

test('H1/G1/D3/S1/P1 · session persistante et pages du groupe', async ({ page }) => {
  await login(page);
  for (const [route, selector] of [
    ['groups', 'app-ui-group-card'], ['expenses', 'app-expense-history'],
    ['statistics', 'app-statistics-summary'], ['account', 'app-profile-panel'],
  ]) {
    await page.goto('/' + route);
    await expect(page.locator(selector).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/' + route + '$'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.locator('app-export-panel')).toBeVisible();
  await expect(page.locator('app-restore-panel')).toBeVisible();
});

test('D2 · à 99 %, effacer les parts et bloquer la création', async ({ page }) => {
  await login(page);
  await page.goto('/expenses?action=add');
  const form = page.locator('app-expense-form');
  await form.locator('#group').click();
  await form.getByRole('option', { name: /Famille recette/ }).click();
  await form.locator('[name=description]').fill('Dîner fictif');
  await form.locator('[name=amount]').fill('10.01');
  await form.getByRole('button', { name: 'Modifier les parts' }).click();
  await form.locator('#expense-split-mode').click();
  await form.getByRole('option', { name: /Pourcentages/ }).click();
  const participants = form.getByRole('checkbox', { name: /^(Moi|Autre membre)/ });
  await expect(participants).toHaveCount(2);
  for (const box of await participants.all()) await box.check();
  const weights = form.locator('input[placeholder="%"]');
  await weights.nth(0).fill('40');
  await weights.nth(1).fill('60');
  await form.getByRole('button', { name: /Calculer les parts/ }).click();
  const preview = form.getByRole('list', { name: /Parts calculées/ });
  await expect(preview).toBeVisible();
  await weights.nth(1).fill('59');
  await expect(preview).toBeHidden();
  const writes = [];
  page.on('request', req => { if (req.url().endsWith('/expenses') && req.method() === 'POST') writes.push(req.url()); });
  await form.getByRole('button', { name: /Enregistrer la dépense/ }).click();
  await expect(form.getByText(/totaliser 100/)).toBeVisible();
  expect(writes).toEqual([]);
});

test('U1 · la galerie de développement est accessible directement', async ({ page }) => {
  await page.goto('/ui/components');
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page).toHaveURL(/\/ui\/components$/);
});

test('G1 · le formulaire présente icônes, couleurs et devise', async ({ page }) => {
  await login(page);
  await page.goto('/groups');
  await page.getByRole('button', { name: 'Créer un groupe' }).filter({ visible: true }).first().click();
  const currency = page.locator('#group-currency');
  await expect(currency.locator('img[src="/flags/ca.svg"]')).toBeVisible();
  await currency.click();
  await page.getByRole('searchbox', { name: 'Rechercher', exact: true }).fill('AED');
  const aed = page.getByRole('option', { name: /AED/ });
  await expect(aed.locator('img[src="/flags/ae.svg"]')).toBeVisible();
  await aed.click();
  await expect(currency.locator('img[src="/flags/ae.svg"]')).toBeVisible();
  for (const [id, label, visual] of [
    ['group-icon', 'Panier', 'svg'], ['group-color', 'Sarcelle', 'span.rounded-full'],
  ]) {
    await page.locator('#' + id).click();
    const option = page.getByRole('option', { name: label, exact: true });
    await expect(option.locator(visual).first()).toBeVisible();
    await option.click();
    await expect(page.locator('#' + id)).toContainText(label);
  }
});

test('G1 · le formulaire de groupe ne déborde pas sur un petit mobile', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/groups');
  await page.getByRole('button', { name: 'Créer un groupe' }).filter({ visible: true }).first().click();
  await expect(page.locator('input[name=groupName]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('D3 · période inversée puis journée inclusive dans l’historique', async ({ page }) => {
  await login(page);
  await page.goto('/expenses');
  const history = page.locator('app-expense-history');
  await history.locator('#history-group').click();
  await history.getByRole('option', { name: /Famille recette/ }).click();
  await history.locator('details summary').first().click();
  const dates = history.locator('input[type=date]');
  await dates.first().fill('2026-11-20');
  await dates.last().fill('2026-11-19');
  const error = history.getByRole('alert');
  await expect(error).toBeVisible();
  for (const date of await dates.all()) {
    await expect(date).toHaveAttribute('aria-invalid', 'true');
    await expect(date).toHaveAttribute('aria-describedby', await error.getAttribute('id'));
  }
  await dates.first().fill('2026-11-19');
  await expect(error).toBeHidden();
});

test('S1 · annuler la période au clavier rend le focus au déclencheur', async ({ page }) => {
  await login(page);
  await page.goto('/statistics');
  const panel = page.locator('app-statistics-summary');
  await panel.locator('#statisticsGroup').click();
  await panel.getByRole('option', { name: /Famille recette/ }).click();
  const trigger = panel.locator('[aria-haspopup=dialog]');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('M3 · une archive illisible est refusée avant envoi', async ({ page }) => {
  await login(page);
  await page.goto('/account');
  const panel = page.locator('app-restore-panel');
  await panel.locator('#restoreGroup').click();
  await panel.getByRole('option', { name: /Famille recette/ }).click();
  const file = panel.locator('input[type=file]');
  await file.setInputFiles({ name: 'fixture.zip', mimeType: 'application/zip', buffer: Buffer.from('invalide') });
  const requests = [];
  page.on('request', r => { if (r.url().endsWith('/backup/preview')) requests.push(r.url()); });
  await panel.getByRole('button', { name: /Vérifier la sauvegarde/ }).click();
  await expect(file).toHaveAttribute('aria-invalid', 'true');
  await expect(file).toBeFocused();
  expect(requests).toEqual([]);
});



test('M1 · refuser un CSV EUR dans le groupe CAD', async ({ page }) => {
  await login(page);
  await page.goto('/account');
  const panel = page.locator('app-import-panel');
  await panel.locator('#importGroup').click();
  await panel.getByRole('option', { name: /Famille recette/ }).click();
  const csv = [
    'Date,Description,Catégorie,Coût,Devise,Alex Exemple,Camille Exemple',
    '2026-11-19,Dîner,Restaurant,12.00,EUR,6,-6',
    '2026-11-19,Solde total,Total, ,EUR,6,-6',
  ].join('\n');
  await panel.locator('input[type=file]').setInputFiles({ name: 'fixture.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await panel.locator('[name=nativeSourceGroup]').fill('source-fictive');
  for (const i of [0, 1]) {
    await panel.locator('#native-member-' + i).click();
    await panel.getByRole('option').nth(i + 1).click();
  }
  await panel.getByRole('button', { name: /Préparer/ }).click();
  await expect(panel.locator('#importFeedback')).toContainText(/devise/i);
  await expect(panel.getByRole('button', { name: /Importer les lignes/, disabled: false })).toHaveCount(0);
});

for (const locale of ['en', 'ja']) {
  test.describe(locale, () => {
    test.use({ locale });
    test('navigation traduite sur les cinq pages privées', async ({ page }) => {
      await login(page);
      for (const path of ['dashboard', 'groups', 'expenses', 'statistics', 'account']) {
        await page.goto('/' + path);
        await expect(page.locator(({ dashboard: 'app-ui-group-card', groups: 'app-ui-group-card', expenses: 'app-expense-history', statistics: 'app-statistics-summary', account: 'app-profile-panel' })[path]).filter({ visible: true }).first()).toBeVisible();
        await expect(page).toHaveURL(new RegExp('/' + path + '$'));
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
      }
    });
  });
}

test('R1/D3 · détail du repas, reçu invalide et annulation de suppression', async ({ page }) => {
  await login(page);
  await page.goto('/expenses');
  const history = page.locator('app-expense-history');
  await history.locator('#history-group').click();
  await history.getByRole('option', { name: /Famille recette/ }).click();
  await history.getByText('Repas de recette', { exact: true }).click();
  const receipt = history.locator('app-receipt-panel');
  const receiptFile = receipt.locator('input[type=file]');
  await expect(receiptFile).toBeEnabled();
  await receiptFile.setInputFiles({
    name: 'texte.txt', mimeType: 'text/plain', buffer: Buffer.from('texte'),
  });
  await expect(receipt.getByRole('alert')).toBeVisible();
  await history.getByRole('button', { name: /Supprimer/ }).first().click();
  await history.getByRole('button', { name: /Annuler/ }).click();
  await expect(history.getByText('Repas de recette')).toBeVisible();
});

test('S2 · refuser le remboursement de zéro et identifier le champ en erreur', async ({ page }) => {
  await login(page);
  await page.goto('/statistics');
  const form = page.locator('app-settlement-form');
  await form.locator('#settlementGroup').click();
  await form.getByRole('option', { name: /Famille recette/ }).click();
  await form.locator('#settlement-recipient').click();
  await form.getByRole('option').last().click();
  const amount = form.locator('[name=settlementAmount]');
  await amount.fill('0');
  await form.locator('button[type=submit]').click();
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(form.locator('#settlement-amount-error')).toBeVisible();
});

test('C1 · prévisualiser une catégorie et refuser un nom vide', async ({ page }) => {
  await login(page);
  await page.goto('/groups');
  await page.locator('app-ui-group-card').filter({ hasText: 'Famille recette' }).first().click();
  await page.getByRole('tab', { name: 'Catégories' }).click();
  const panel = page.locator('app-category-manager');
  await panel.locator('#categoryGroup').click();
  await panel.getByRole('option', { name: /Famille recette/ }).click();
  const create = panel.getByRole('button', { name: /Créer la catégorie|Créer une catégorie/ });
  await expect(create).toBeDisabled();
  await panel.locator('[name=categoryName]').fill('Sortie vélo');
  await expect(panel.getByText(/Sortie vélo/)).toBeVisible();
  await expect(create).toBeEnabled();
});

test('A2 · après déconnexion, Retour puis une URL privée restent sur la connexion', async ({ page }) => {
  await login(page);
  await page.goto('/account');
  await page.locator('main').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack({ waitUntil: 'commit' });
  await expect(page.locator('#login-password')).toHaveValue('');
  await page.goto('/expenses');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('app-expense-history')).toHaveCount(0);
});

test('M2 · télécharger le JSON du groupe EUR et contrôler son contenu', async ({ page }) => {
  await login(page);
  await page.goto('/account');
  const panel = page.locator('app-export-panel');
  await panel.locator('#exportGroup').click();
  await panel.getByRole('option', { name: /Voyage recette/ }).click();
  await panel.locator('#export-kind').click();
  await panel.getByRole('option', { name: /JSON du groupe/ }).click();
  const ready = page.waitForEvent('download', { timeout: 10000 });
  await panel.getByRole('button', { name: /Télécharger/ }).click();
  const file = await ready;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.group).toMatchObject({ id: 'voyage', currency: 'EUR' });
  expect(exported.expenses).toEqual([]);
  expect(exported.members).toHaveLength(2);
});
