import { test } from 'node:test';
import { strictEqual, throws } from 'node:assert';
import { serializeGroupLedgerCsvV1 } from '../../src/app/features/import-export/group-csv';
import type { GroupExportV1 } from '../../src/app/features/import-export/export-v1';

const fixture: GroupExportV1 = {
  format: 'OurFinanceGroupExport', version: 1, exportedAt: '2026-11-16T18:00:00.000Z',
  group: { id: 'fake_group', name: 'Fictif', currency: 'CAD' },
  members: [{ userId: 'alex', role: 'owner', status: 'active' }, { userId: 'camille', role: 'member', status: 'active' }],
  expenses: [{ id: 'expense_1', date: '2026-10-01', description: '=HYPERLINK("bad")\nFictif', currency: 'CAD', amountMinor: 101,
    categoryId: 'cat_1', categoryLabel: 'Épicerie', categoryIcon: 'circle', categoryColor: 'teal',
    payments: [{ userId: 'alex', amountMinor: 101 }], allocations: [{ userId: 'alex', amountMinor: 50 }, { userId: 'camille', amountMinor: 51 }],
    splitSnapshotJson: '{"kind":"exact"}', deleted: false }],
  settlements: [{ id: 'settlement_1', date: '2026-10-02', currency: 'CAD', amountMinor: 51,
    fromUserId: 'camille', toUserId: 'alex', status: 'recorded', deleted: false }],
  importedRecords: [{ id: 'import_1', sourceId: 'synthetic-1', batchId: 'batch_1', date: '2026-09-01',
    description: 'Ancien', currency: 'CAD', amountMinor: 100, netImpactsMinor: { alex: 50, camille: -50 },
    splitStatus: 'undetermined', status: 'active' }], categories: [], receipts: [],
};

test('CSV report keeps exact minor units, settlement direction and historical uncertainty', () => {
  const csv = serializeGroupLedgerCsvV1(fixture);
  strictEqual(csv.startsWith('\uFEFF"Type"'), true);
  strictEqual(csv.includes('"expense","expense_1","2026-10-01","\'=HYPERLINK(""bad"")\nFictif","CAD","101","alex","101","50","51"'), true);
  strictEqual(csv.includes('"expense","expense_1","2026-10-01","\'=HYPERLINK(""bad"")\nFictif","CAD","101","camille","0","51","-51"'), true);
  strictEqual(csv.includes('"settlement","settlement_1","2026-10-02","","CAD","51","camille","0","0","51"'), true);
  strictEqual(csv.includes('"settlement","settlement_1","2026-10-02","","CAD","51","alex","0","0","-51"'), true);
  strictEqual(csv.includes('"import","import_1","2026-09-01","Ancien","CAD","100","camille","0","0","-50","undetermined"'), true);
  strictEqual(csv.includes('publicId'), false);
});

test('CSV report puts exact historical decimals in separate columns without rounding', () => {
  const exact: GroupExportV1 = { ...fixture, importedRecords: [{ id: 'native_1', sourceId: 'native-example-1', batchId: 'batch_1',
    date: '2026-11-01', description: 'Trajet fictif', currency: 'CAD', sourceCostExact: '101.50', sourcePrecision: 2,
    netImpactsExact: { alex: '50.75', camille: '-50.75' }, splitStatus: 'undetermined', status: 'active' }] };
  const csv = serializeGroupLedgerCsvV1(exact);
  strictEqual(csv.includes('"Coût source exact","Précision source","Impact net exact"'), true);
  strictEqual(csv.includes('"import","native_1","2026-11-01","Trajet fictif","CAD","","alex","","","","undetermined","active","","","101.50","2","50.75"'), true);
  strictEqual(csv.includes('"-50.75"'), true);
});

test('CSV report refuses an unbalanced source and marks logical deletion', () => {
  throws(() => serializeGroupLedgerCsvV1({ ...fixture, expenses: [{ ...fixture.expenses[0], amountMinor: 102 }] }));
  const deleted = serializeGroupLedgerCsvV1({ ...fixture, expenses: [{ ...fixture.expenses[0], deleted: true }] });
  strictEqual(deleted.includes('"determined","deleted"'), true);
});

test('CSV report refuses negative shares before computing member impacts', () => {
  const extreme = { ...fixture.expenses[0], amountMinor: 1,
    payments: [{ userId: 'alex', amountMinor: Number.MAX_SAFE_INTEGER }, { userId: 'camille', amountMinor: 1 - Number.MAX_SAFE_INTEGER }],
    allocations: [{ userId: 'alex', amountMinor: 1 - Number.MAX_SAFE_INTEGER }, { userId: 'camille', amountMinor: Number.MAX_SAFE_INTEGER }],
  };
  throws(() => serializeGroupLedgerCsvV1({ ...fixture, expenses: [extreme] }));
});
