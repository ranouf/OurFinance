import { test } from 'node:test';
import { strictEqual, throws } from 'node:assert';
import type { GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { buildRestoreWrites } from '../src/restore-writes';

const at = '2026-11-16T18:00:00.000Z';
const restoreId = '123e4567-e89b-42d3-a456-426614174000';
const group: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, exportedAt: at,
  group: { id: 'g', name: 'Fictif', currency: 'CAD' },
  members: [{ userId: 'alice', role: 'owner', status: 'active' }],
  expenses: [{ id: 'e', date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 101,
    categoryId: 'other', categoryLabel: 'Autre', categoryIcon: 'receipt', categoryColor: 'slate',
    payments: [{ userId: 'alice', amountMinor: 101 }], allocations: [{ userId: 'alice', amountMinor: 101 }],
    splitSnapshotJson: '{"kind":"equal","users":["alice"]}', deleted: false }],
  settlements: [], importedRecords: [], categories: [],
  receipts: [{ expenseId: 'e', attachmentId: 'a', format: 'png', status: 'active', mediaIncluded: false }],
  expenseAuthors: [{ expenseId: 'e', userId: 'alice' }], receiptOwners: [{ expenseId: 'e', attachmentId: 'a', ownerId: 'alice' }],
  comments: [], activity: [{ id: 'e', actorId: 'alice', action: 'expense_created', expenseId: 'e', at }], importBatches: [],
  preferences: [{ userId: 'alice', modeJson: '{"kind":"equal","users":["alice"]}', memberIds: ['alice'], updatedAt: at }],
};
const publicId = `ourfinance-test/g/e/restore_${restoreId}/a`;
const staged = [{ expenseId: 'e', attachmentId: 'a', publicId, format: 'png' as const }];
const live = { groupDocuments: ['groups/g', 'groups/g/members/alice', 'groups/g/expenses/old'],
  userDocuments: ['users/alice/groupMemberships/g', 'users/alice/groupPreferences/g'], receiptPublicIds: ['ourfinance-test/g/old/a'] };

test('atomic restore plan replaces old expense, keeps authors and points to staged private receipt', () => {
  const plan = buildRestoreWrites(group, live, staged, 'ourfinance-test', restoreId, at);
  const writes = plan.writes as { delete?: string; update?: { name: string; fields: Record<string, { stringValue?: string }> }; updateMask?: { fieldPaths: string[] } }[];
  strictEqual(writes.some(row => row.delete?.endsWith('/groups/g/expenses/old')), true);
  strictEqual(writes.find(row => row.update?.name.endsWith('/groups/g/expenses/e'))?.update?.fields.createdBy.stringValue, 'alice');
  strictEqual(writes.find(row => row.update?.name.endsWith('/groups/g/expenses/e/attachments/a'))?.update?.fields.publicId.stringValue, publicId);
  strictEqual(writes.find(row => row.update?.name.endsWith('/groups/g'))?.update?.fields.status.stringValue, 'active');
  strictEqual(writes.find(row => row.update?.name.endsWith('/groups/g'))?.update?.fields.lastRestoreId.stringValue, restoreId);
  strictEqual(writes.find(row => row.update?.name.endsWith('/groups/g'))?.updateMask?.fieldPaths.includes('restoreId'), true);
  strictEqual(writes.some(row => row.update?.name.endsWith(`/groups/g/restoreJobs/${restoreId}`)), true);
  strictEqual(plan.previousReceiptPublicIds[0], 'ourfinance-test/g/old/a');
});

test('restore plan rejects missing or redirected staged media', () => {
  throws(() => buildRestoreWrites(group, live, [], 'ourfinance-test', restoreId, at));
  throws(() => buildRestoreWrites(group, live, [{ ...staged[0], publicId: `ourfinance-test/other/e/restore_${restoreId}/a` }], 'ourfinance-test', restoreId, at));
});
