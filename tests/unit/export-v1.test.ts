import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { serializeGroupExportV1, type GroupExportV1 } from '../../src/app/features/import-export/export-v1';

const fixture: GroupExportV1 = {
  format: 'OurFinanceGroupExport', version: 1, exportedAt: '2026-11-16T18:00:00.000Z',
  group: { id: 'group_test', name: 'Groupe fictif', currency: 'CAD' },
  members: [{ userId: 'member_a', role: 'owner', status: 'active' }, { userId: 'member_b', role: 'member', status: 'active' }],
  expenses: [{ id: 'expense_1', date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 101, categoryId: 'custom_1', categoryLabel: 'Transport fictif', categoryIcon: '🚆', categoryColor: 'teal', payments: [{ userId: 'member_a', amountMinor: 101 }], allocations: [{ userId: 'member_a', amountMinor: 50 }, { userId: 'member_b', amountMinor: 51 }], splitSnapshotJson: '{"kind":"exact"}', deleted: false }],
  settlements: [{ id: 'settlement_1', date: '2026-11-02', currency: 'CAD', amountMinor: 51, fromUserId: 'member_b', toUserId: 'member_a', status: 'recorded', deleted: false }],
  importedRecords: [{ id: 'hash_1', sourceId: 'synthetic-1', batchId: 'batch_1', date: '2026-10-01', description: 'Historique fictif', currency: 'CAD', amountMinor: 100, netImpactsMinor: { member_a: 50, member_b: -50 }, splitStatus: 'undetermined', status: 'active' }],
  categories: [{ id: 'custom_1', name: 'Transport fictif', iconId: 'train', color: 'teal', status: 'active' }],
  receipts: [{ expenseId: 'expense_1', attachmentId: 'receipt_1', format: 'png', status: 'active', mediaIncluded: false }],
};

test('versioned group export preserves exact minor units and declares media absent', () => {
  const json = serializeGroupExportV1(fixture);
  deepStrictEqual(JSON.parse(json), fixture);
  strictEqual(json.includes('"mediaIncluded": false'), true);
  strictEqual(json.includes('"amountMinor": 101'), true);
});

test('refuses inconsistent money, members and receipt references', () => {
  throws(() => serializeGroupExportV1({ ...fixture, expenses: [{ ...fixture.expenses[0], allocations: [{ userId: 'member_b', amountMinor: 100 }] }] }));
  throws(() => serializeGroupExportV1({ ...fixture, settlements: [{ ...fixture.settlements[0], toUserId: 'outsider' }] }));
  throws(() => serializeGroupExportV1({ ...fixture, importedRecords: [{ ...fixture.importedRecords[0], netImpactsMinor: { member_a: 50, member_b: -49 } }] }));
  throws(() => serializeGroupExportV1({ ...fixture, receipts: [{ ...fixture.receipts[0], expenseId: 'other' }] }));
});

test('exports only declared fields even when a source object carries an extra secret', () => {
  const source = { ...fixture, group: { ...fixture.group, accidentalSecret: 'never-export' } };
  strictEqual(serializeGroupExportV1(source).includes('never-export'), false);
});

test('refuses duplicate or negative shares and invalid logical states', () => {
  const expense = fixture.expenses[0];
  throws(() => serializeGroupExportV1({ ...fixture, expenses: [{ ...expense, allocations: [expense.allocations[0], expense.allocations[0], { userId: 'member_b', amountMinor: 1 }] }] }));
  throws(() => serializeGroupExportV1({ ...fixture, expenses: [{ ...expense, allocations: [{ userId: 'member_a', amountMinor: -1 }, { userId: 'member_b', amountMinor: 102 }] }] }));
  throws(() => serializeGroupExportV1({ ...fixture, expenses: [{ ...expense, deleted: 'false' as unknown as boolean }] }));
  throws(() => serializeGroupExportV1({ ...fixture, receipts: [{ ...fixture.receipts[0], status: 'unknown' as 'active' }] }));
  throws(() => serializeGroupExportV1({ ...fixture, expenses: [{ ...expense, deleted: true }] }));
  throws(() => serializeGroupExportV1({ ...fixture, categories: [{ ...fixture.categories[0], status: 'unexpected' as 'active' }] }));
});
