import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { serializeGroupExportV2, type GroupExportV2 } from '../../src/app/features/import-export/export-v2';

const exportedAt = '2026-11-16T18:00:00.000Z';
const fixture: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, exportedAt,
  group: { id: 'g', name: 'Groupe fictif', currency: 'CAD' },
  members: [{ userId: 'alice', role: 'owner', status: 'active' }, { userId: 'bob', role: 'member', status: 'revoked' }],
  expenses: [], settlements: [], importedRecords: [], categories: [], receipts: [],
  expenseAuthors: [],
  comments: [],
  activity: [],
  importBatches: [],
  preferences: [
    { userId: 'alice', modeJson: '{"kind":"exact","amounts":[{"userId":"alice","amountMinor":50},{"userId":"bob","amountMinor":51}]}', memberIds: ['alice', 'bob'], updatedAt: exportedAt },
    { userId: 'bob', modeJson: null, memberIds: [], updatedAt: null },
  ],
};

test('V2 preserves every member preference or its explicit absence', () => {
  const json = serializeGroupExportV2(fixture);
  const value = JSON.parse(json) as GroupExportV2;
  strictEqual(value.version, 2);
  deepStrictEqual(value.preferences, fixture.preferences);
  strictEqual(value.group.currency, 'CAD');
});

test('V2 rejects missing, foreign or inconsistent preferences', () => {
  throws(() => serializeGroupExportV2({ ...fixture, preferences: fixture.preferences.slice(0, 1) }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...fixture.preferences[0], userId: 'outsider' }, fixture.preferences[1]] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...fixture.preferences[0], memberIds: ['alice'] }, fixture.preferences[1]] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [fixture.preferences[0], { ...fixture.preferences[1], updatedAt: exportedAt }] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...fixture.preferences[0], modeJson: '{"kind":"equal","users":["outsider"]}' }, fixture.preferences[1]] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [null as unknown as GroupExportV2['preferences'][number], fixture.preferences[1]] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...fixture.preferences[0], updatedAt: 'tomorrow' }, fixture.preferences[1]] }));
});

test('V2 validates percentages, signed adjustments and removes unexpected preference fields', () => {
  const percentage = { ...fixture.preferences[0], modeJson: '{"kind":"percentage","weightsBasisPoints":[{"userId":"alice","value":5000},{"userId":"bob","value":5000}]}' };
  const valid = { ...fixture, preferences: [{ ...percentage, accidentalSecret: 'never-export' }, fixture.preferences[1]] };
  strictEqual(serializeGroupExportV2(valid).includes('never-export'), false);
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...percentage, modeJson: '{"kind":"percentage","weightsBasisPoints":[{"userId":"alice","value":5000}]}' }, fixture.preferences[1]] }));
  const adjustment = { ...fixture.preferences[0], modeJson: '{"kind":"adjustment","adjustments":[{"userId":"alice","amountMinor":-10},{"userId":"bob","amountMinor":10}]}' };
  strictEqual(JSON.parse(serializeGroupExportV2({ ...fixture, preferences: [adjustment, fixture.preferences[1]] })).preferences[0].modeJson, adjustment.modeJson);
});

test('V2 rejects expense authors outside the member set', () => {
  const expense = { id: 'e', date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 101,
    categoryId: 'other', categoryLabel: 'Autre', categoryIcon: 'receipt', categoryColor: 'slate',
    payments: [{ userId: 'alice', amountMinor: 101 }], allocations: [{ userId: 'alice', amountMinor: 101 }],
    splitSnapshotJson: '{"kind":"equal","users":["alice"]}', deleted: false };
  const withExpense = { ...fixture, expenses: [expense], expenseAuthors: [{ expenseId: 'e', userId: 'alice' }] };
  strictEqual(JSON.parse(serializeGroupExportV2(withExpense)).expenseAuthors[0].userId, 'alice');
  throws(() => serializeGroupExportV2({ ...withExpense, expenseAuthors: [] }));
  throws(() => serializeGroupExportV2({ ...withExpense, expenseAuthors: [{ expenseId: 'e', userId: 'outsider' }] }));
});

test('V2 rejects comments outside the archived expense or membership', () => {
  throws(() => serializeGroupExportV2({ ...fixture, comments: [{ expenseId: 'missing', id: 'c', authorId: 'alice', text: 'Fictif', createdAt: exportedAt }] }));
  throws(() => serializeGroupExportV2({ ...fixture, comments: [{ expenseId: 'missing', id: 'c', authorId: 'outsider', text: 'Fictif', createdAt: exportedAt }] }));
});

test('V2 rejects activity from an outsider or an unknown action', () => {
  const event = { id: 'event', actorId: 'alice', action: 'expense_created', at: exportedAt, expenseId: 'expense' };
  throws(() => serializeGroupExportV2({ ...fixture, activity: [{ ...event, actorId: 'outsider' }] }));
  throws(() => serializeGroupExportV2({ ...fixture, activity: [{ ...event, action: 'unknown' }] }));
});

test('V2 requires each import batch and its exact archived record IDs', () => {
  const record = { id: 'record', sourceId: 'synthetic-001', batchId: 'batch', date: '2026-11-01', description: 'Fictif',
    currency: 'CAD', amountMinor: 101, netImpactsMinor: { alice: 101, bob: -101 }, splitStatus: 'undetermined' as const, status: 'active' as const };
  const batch = { id: 'batch', ownerId: 'alice', status: 'active' as const, source: 'splitwise_csv' as const,
    recordIds: ['record'], createdAt: exportedAt, undoneAt: null };
  const withImport = { ...fixture, importedRecords: [record], importBatches: [batch] };
  strictEqual(JSON.parse(serializeGroupExportV2(withImport)).importBatches[0].recordIds[0], 'record');
  throws(() => serializeGroupExportV2({ ...withImport, importBatches: [] }));
  throws(() => serializeGroupExportV2({ ...withImport, importBatches: [{ ...batch, recordIds: ['other'] }] }));
});
