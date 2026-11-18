import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { collectGroupExportV1, type ExportDocument, type ExportReader } from '../../src/app/features/import-export/export-collector';

const root = 'groups/group_test';
const member = { id: 'member_a', data: { role: 'owner', status: 'active' } };
const docs: Record<string, ExportDocument | null> = {
  [root]: { id: 'group_test', data: { name: 'Groupe fictif', currency: 'CAD', status: 'active' } },
  [`${root}/members/member_a`]: member,
};
const collections: Record<string, ExportDocument[]> = {
  [`${root}/members`]: [member, { id: 'member_b', data: { role: 'member', status: 'active' } }],
  [`${root}/expenses`]: [{ id: 'expense_1', data: {
    date: '2026-11-01', description: 'Épicerie fictive', currency: 'CAD', amountMinor: 101, categoryId: 'other',
    categoryLabel: 'Autre', categoryIcon: 'circle', categoryColor: 'slate',
    payments: [{ userId: 'member_a', amountMinor: 101 }], allocations: [{ userId: 'member_a', amountMinor: 50 }, { userId: 'member_b', amountMinor: 51 }],
    splitSnapshotJson: '{"kind":"exact"}', deleted: false,
  } }],
  [`${root}/settlements`]: [{ id: 'settlement_1', data: { date: '2026-11-02', currency: 'CAD', amountMinor: 51, fromUserId: 'member_b', toUserId: 'member_a', status: 'recorded', deleted: false } }],
  [`${root}/importedRecords`]: [{ id: 'import_1', data: { sourceId: 'synthetic-1', batchId: 'batch_1', date: '2026-10-01', description: 'Historique fictif', currency: 'CAD', amountMinor: 100, netImpactsMinor: { member_a: 50, member_b: -50 }, splitStatus: 'undetermined', status: 'active' } }],
  [`${root}/categories`]: [{ id: 'custom_1', data: { name: 'Transport fictif', iconId: 'train', color: 'teal', status: 'active' } }],
  [`${root}/expenses/expense_1/attachments`]: [{ id: 'receipt_1', data: { format: 'png', status: 'active', publicId: 'private-asset-not-exported' } }],
};
const user = { uid: 'member_a', emailVerified: true };
const reader: ExportReader = {
  read: async path => docs[path] ?? null,
  list: async path => collections[path] ?? [],
};

test('collects all group collections and only receipt metadata', async () => {
  const value = JSON.parse(await collectGroupExportV1(reader, user, 'group_test', '2026-11-16T18:00:00.000Z'));
  strictEqual(value.expenses[0].amountMinor, 101);
  deepStrictEqual(value.expenses[0].allocations.map((item: { amountMinor: number }) => item.amountMinor), [50, 51]);
  strictEqual(value.importedRecords[0].netImpactsMinor.member_a, 50);
  deepStrictEqual(value.receipts, [{ expenseId: 'expense_1', attachmentId: 'receipt_1', format: 'png', status: 'active', mediaIncluded: false }]);
  strictEqual(JSON.stringify(value).includes('private-asset-not-exported'), false);
});

test('collects exact imported strings without converting them to currency minor units', async () => {
  const exact: ExportReader = { ...reader, list: async path => path === `${root}/importedRecords` ? [
    { id: 'native_1', data: { sourceId: 'native-example-1', batchId: 'batch_1', date: '2026-11-01',
      description: 'Trajet fictif', currency: 'CAD', sourceCostExact: '101.50', sourcePrecision: 2,
      netImpactsExact: { member_a: '50.75', member_b: '-50.75' }, splitStatus: 'undetermined', status: 'active' } },
  ] : reader.list(path) };
  const value = JSON.parse(await collectGroupExportV1(exact, user, 'group_test'));
  deepStrictEqual(value.importedRecords[0].netImpactsExact, { member_a: '50.75', member_b: '-50.75' });
  strictEqual('amountMinor' in value.importedRecords[0], false);
});

test('refuses an imported document with both exact and legacy money fields', async () => {
  const ambiguous: ExportReader = { ...reader, list: async path => path === `${root}/importedRecords` ? [
    { ...collections[path][0], data: { ...collections[path][0].data, sourceCostExact: '1.00', sourcePrecision: 2,
      netImpactsExact: { member_a: '0.50', member_b: '-0.50' } } },
  ] : reader.list(path) };
  await rejects(collectGroupExportV1(ambiguous, user, 'group_test'), /ambigu/);
});

test('refuses a partial exact variant rather than exporting it as legacy money', async () => {
  const partial: ExportReader = { ...reader, list: async path => path === `${root}/importedRecords` ? [
    { ...collections[path][0], data: { ...collections[path][0].data, sourcePrecision: 2 } },
  ] : reader.list(path) };
  await rejects(collectGroupExportV1(partial, user, 'group_test'), /ambigu/);
});

test('refuses unverified users, missing category snapshot and membership revoked during collection', async () => {
  await rejects(collectGroupExportV1(reader, { ...user, emailVerified: false }, 'group_test'));
  const invalid: ExportReader = { ...reader, list: async path => path === `${root}/expenses` ? [{ ...collections[path][0], data: { ...collections[path][0].data, categoryLabel: undefined } }] : reader.list(path) };
  await rejects(collectGroupExportV1(invalid, user, 'group_test'));
  let membershipReads = 0;
  const revoked: ExportReader = { ...reader, read: async path => {
    if (path === `${root}/members/member_a` && ++membershipReads === 2) return { ...member, data: { ...member.data, status: 'revoked' } };
    return reader.read(path);
  } };
  await rejects(collectGroupExportV1(revoked, user, 'group_test'), /révoqué/);
});

test('refuses unknown receipt states and an active receipt on a deleted expense', async () => {
  const unknown: ExportReader = { ...reader, list: async path => path.endsWith('/attachments') ?
    [{ id: 'receipt_1', data: { format: 'png', status: 'pending' } }] : reader.list(path) };
  await rejects(collectGroupExportV1(unknown, user, 'group_test'), /status/);
  const deleted: ExportReader = { ...reader, list: async path => path === `${root}/expenses` ?
    [{ ...collections[path][0], data: { ...collections[path][0].data, deleted: true } }] : reader.list(path) };
  await rejects(collectGroupExportV1(deleted, user, 'group_test'), /reçu/i);
});

test('uses currencyCode and refuses an old transaction in another currency', async () => {
  const current: ExportReader = { ...reader, read: async path => path === root ?
    { id: 'group_test', data: { name: 'Groupe fictif', currency: 'JPY', currencyCode: 'CAD', status: 'active' } } : reader.read(path) };
  const value = JSON.parse(await collectGroupExportV1(current, user, 'group_test'));
  strictEqual(value.group.currency, 'CAD');
  const mixed: ExportReader = { ...current, list: async path => path === `${root}/settlements` ?
    [{ ...collections[path][0], data: { ...collections[path][0].data, currency: 'JPY' } }] : reader.list(path) };
  await rejects(collectGroupExportV1(mixed, user, 'group_test'), /Règlement/);
});

test('fails closed on missing group, inactive membership and malformed historical fields', async () => {
  await rejects(collectGroupExportV1(reader, user, '../other'), /autorisé/);
  for (const status of [null, 'deleted']) {
    const unavailable: ExportReader = { ...reader, read: async path => path === root
      ? status === null ? null : { id: 'group_test', data: { ...docs[root]!.data, status } }
      : reader.read(path) };
    await rejects(collectGroupExportV1(unavailable, user, 'group_test'), /indisponible/);
  }
  const inactive: ExportReader = { ...reader, read: async path => path.endsWith('/members/member_a')
    ? { ...member, data: { ...member.data, status: 'revoked' } } : reader.read(path) };
  await rejects(collectGroupExportV1(inactive, user, 'group_test'), /inactif/);
  for (const imported of [
    { ...collections[`${root}/importedRecords`][0].data, netImpactsMinor: [1] },
    { ...collections[`${root}/importedRecords`][0].data, netImpactsMinor: { member_a: '50' } },
    { ...collections[`${root}/importedRecords`][0].data, sourceCostExact: '1.00' },
  ]) {
    const invalid: ExportReader = { ...reader, list: async path => path === `${root}/importedRecords`
      ? [{ id: 'import_1', data: imported }] : reader.list(path) };
    await rejects(collectGroupExportV1(invalid, user, 'group_test'));
  }
});
