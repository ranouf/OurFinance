import { test, expect, login } from './fixtures.mjs';
test.use({ video: 'on' });

test('D1 · groupe global, recherche et montants du mois restent dans la devise du groupe', async ({ page }, testInfo) => {
  await login(page);
  const groupPicker = page.locator('header select');
  await expect(groupPicker).toHaveValue('famille');
  await expect(page.getByText('On te doit', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Ma part ce mois-ci').filter({ visible: true })).toBeVisible();
  await page.addStyleTag({ content: '.firebase-emulator-warning { display: none !important; }' });
  await page.screenshot({ path: testInfo.outputPath('dashboard-real.png') });
  await groupPicker.selectOption('voyage');
  await expect(groupPicker).toHaveValue('voyage');
  await expect(page.getByText('Voyage recette', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Tes comptes sont équilibrés', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.reload();
  await expect(groupPicker).toHaveValue('voyage');
  await groupPicker.selectOption('famille');
  await page.locator('#global-expense-search').fill('Repas');
  await page.locator('header form[role=search]').press('Enter');
  await expect(page).toHaveURL(/\/expenses\?.*group=famille.*search=Repas/);
  await expect(page.locator('input[name=historySearch]')).toHaveValue('Repas');
  await expect(page.getByRole('searchbox', { name: 'Rechercher une dépense' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('dashboard-search.png'), fullPage: true });
});

test.describe('preuves visuelles Dashboard', () => {
  test('D5 · visite commentée des actions principales', async ({ page }) => {
    test.skip(![390, 1280].includes(page.viewportSize()?.width ?? 0));
    await login(page);
    await page.addStyleTag({ content: '.firebase-emulator-warning { display: none !important; }' });
    await page.waitForTimeout(600);
    await page.locator('header select').selectOption('voyage');
    await expect(page.locator('header select')).toHaveValue('voyage');
    await page.waitForTimeout(500);
    await page.locator('header select').selectOption('famille');
    await page.waitForTimeout(500);
    await page.getByRole('link', { name: 'Ajouter une dépense' }).filter({ visible: true }).first().click();
    await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible();
  });
});

test('D2 · le changement de groupe demande de protéger une dépense saisie', async ({ page }) => {
  await login(page);
  await page.goto('/expenses?action=add');
  await page.getByRole('textbox', { name: 'Description' }).fill('Dépense fictive non enregistrée');
  await page.locator('header select').selectOption('voyage');
  const dialog = page.getByRole('dialog', { name: 'Changer de groupe ?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Garder le brouillon' }).click();
  await expect(page.locator('header select')).toHaveValue('famille');
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('Dépense fictive non enregistrée');
  await page.locator('header select').selectOption('voyage');
  await dialog.getByRole('button', { name: 'Abandonner et changer' }).click();
  await expect(page.locator('header select')).toHaveValue('voyage');
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('');
});

test('D2b · quitter le formulaire demande de conserver ou abandonner le brouillon', async ({ page }) => {
  await login(page);
  await page.goto('/expenses?action=add');
  await page.getByRole('textbox', { name: 'Description' }).fill('Dépense fictive abandonnée');
  await page.getByRole('navigation', { name: 'Navigation principale' }).filter({ visible: true }).first().getByRole('link', { name: 'Accueil' }).click();
  const dialog = page.getByRole('dialog', { name: 'Quitter la dépense ?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Garder le brouillon' }).click();
  await expect(page).toHaveURL(/\/expenses/);
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('Dépense fictive abandonnée');
  await page.getByRole('navigation', { name: 'Navigation principale' }).filter({ visible: true }).first().getByRole('link', { name: 'Accueil' }).click();
  await dialog.getByRole('button', { name: 'Abandonner et quitter' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.locator('header select').selectOption('voyage');
  await expect(page.locator('header select')).toHaveValue('voyage');
  await expect(page.getByRole('dialog', { name: 'Changer de groupe ?' })).toBeHidden();
});

test('D3 · le bouton central mobile ouvre le formulaire du groupe actif', async ({ page }) => {
  test.skip(page.viewportSize()?.width > 390, 'Navigation basse mobile seulement');
  await login(page);
  await page.getByRole('navigation', { name: 'Navigation principale' }).last().getByRole('link', { name: 'Ajouter une dépense' }).click();
  await expect(page).toHaveURL(/\/expenses\?.*group=famille.*action=add/);
  await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible();
});

test('D3b · le bouton central rouvre le formulaire depuis l’historique mobile', async ({ page }) => {
  test.skip(page.viewportSize()?.width > 390, 'Navigation basse mobile seulement');
  await login(page);
  await page.goto('/expenses');
  const add = page.getByRole('navigation', { name: 'Navigation principale' }).last().getByRole('link', { name: 'Ajouter une dépense' });
  await add.click();
  await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible();
  await page.getByRole('button', { name: /Dépenses/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Description' })).toBeHidden();
  await add.click();
  await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible();
});

test('D6 · fermer l’invitation par Échap rend le focus au raccourci', async ({ page }) => {
  await login(page);
  const trigger = page.getByRole('button', { name: 'Inviter des membres' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Inviter des membres' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Inviter des membres' })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('D7 · un membre voit pourquoi l’invitation est indisponible', async ({ page }) => {
  await login(page, 'alex@example.invalid');
  const invite = page.getByRole('link', { name: /Inviter des membres/ }).filter({ visible: true }).first();
  await expect(invite).toContainText('Seul le propriétaire');
  await invite.click();
  await expect(page).toHaveURL(/\/groups#qr-invitations/);
});

test('D4 · sans groupe, les trois parcours de démarrage restent accessibles', async ({ page }) => {
  const email = `new-${crypto.randomUUID()}@example.invalid`;
  const password = 'Only-in-local-emulators-123';
  const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
  const created = await fetch(`${authUrl}/accounts:signUp?key=demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  expect(created.ok).toBeTruthy();
  const { localId } = await created.json();
  const verified = await fetch(`${authUrl}/accounts:update?key=demo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ localId, emailVerified: true }) });
  expect(verified.ok).toBeTruthy();
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: /Créer mon premier groupe/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejoindre un groupe' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Importer mes dépenses' })).toBeVisible();
  await page.locator('#dashboard-invite-link').fill('https://example.invalid/join#invite=invalid');
  await page.getByRole('button', { name: 'Rejoindre un groupe' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Ce lien d’invitation' })).toBeVisible();
  await page.getByRole('link', { name: /Créer mon premier groupe/ }).last().click();
  await expect(page).toHaveURL(/\/groups\?intent=import/);
});


