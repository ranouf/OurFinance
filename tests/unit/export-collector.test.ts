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
