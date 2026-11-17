import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert';
import { parseCsv } from '../../src/app/features/import-export/csv';
import { previewMappedCsv } from '../../src/app/features/import-export/import-v1';
import { reconcileImpacts } from '../../src/app/features/import-export/reconcile';
import { prepareNativeImportBatches } from '../../src/app/features/import-export/prepare-batch';
import { parseNativeSplitwiseCsv } from '../../src/app/features/import-export/splitwise-native-csv';
test('quoted commas and newlines parse without losing data', () => {
  deepStrictEqual(parseCsv('a,b\r\n"hello,\nworld",x\r\n'), [['a','b'],['hello,\nworld','x']]);
  throws(() => parseCsv('"unclosed'));
});
test('import preview detects duplicates and keeps historical split undetermined', () => {
  const mapping = { sourceId: 'id', groupId: 'group', date: 'date', description: 'description', amountMinor: 'minor', currency: 'currency' };
  const preview = previewMappedCsv('id,group,date,description,minor,currency\n1,g,2026-11-10,Test,100,CAD\n1,g,2026-11-11,Again,100,CAD\n2,g,invalid,Bad,100,CAD', mapping, new Set());
  strictEqual(preview.records.length, 1);
  strictEqual(preview.records[0].splitStatus, 'undetermined');
  deepStrictEqual(preview.duplicateIds, ['1']);
  strictEqual(preview.errors.length, 1);
});

test('synthetic Splitwise impacts reconcile without inventing historical shares', async () => {
  const { readFileSync } = await import('node:fs');
  const csv = readFileSync('tests/fixtures/splitwise-synthetique.csv', 'utf8');
  const mapping = { sourceId: 'Source ID', groupId: 'Group ID', date: 'Date', description: 'Description', amountMinor: 'Amount Minor', currency: 'Currency' };
  const impacts = { alex: 'Alex Exemple', camille: 'Camille Exemple', sam: 'Sam Exemple' };
  const preview = previewMappedCsv(csv, mapping, new Set(), impacts);
  strictEqual(preview.errors.length, 0);
  strictEqual(preview.records.length, 3);
  const balance = Object.fromEntries(Object.keys(impacts).map(id => [id, preview.records.reduce((sum, record) => sum + (record.netImpactsMinor?.[id] ?? 0), 0)]));
  deepStrictEqual(balance, { alex: 1500, camille: -1500, sam: 0 });
  strictEqual(preview.records.every(record => record.splitStatus === 'undetermined'), true);
  const again = previewMappedCsv(csv, mapping, new Set(preview.records.map(record => JSON.stringify([record.groupId, record.sourceId]))), impacts);
  strictEqual(again.records.length, 0);
  strictEqual(again.duplicateIds.length, 3);
  const expected = [
    { groupId: 'groupe-test', currency: 'CAD', userId: 'alex', balanceMinor: '1500' },
    { groupId: 'groupe-test', currency: 'CAD', userId: 'camille', balanceMinor: '-1500' },
    { groupId: 'groupe-test', currency: 'CAD', userId: 'sam', balanceMinor: '0' },
  ];
  const reconciliation = reconcileImpacts(preview.records, expected);
  strictEqual(reconciliation.matched, true);
  strictEqual(reconciliation.missingImpactRecords, 0);
  strictEqual(reconciliation.differences.every(row => row.differenceMinor === '0'), true);
  const mismatch = reconcileImpacts(preview.records, expected.map(row => row.userId === 'alex' ? { ...row, balanceMinor: '1400' } : row));
  strictEqual(mismatch.matched, false);
  strictEqual(mismatch.differences.find(row => row.userId === 'alex')?.differenceMinor, '100');
});

test('invalid CSV dates, currencies, empty amounts and missing impact data are explicit', () => {
  const mapping = { sourceId: 'id', groupId: 'group', date: 'date', description: 'description', amountMinor: 'minor', currency: 'currency' };
  const csv = 'id,group,date,description,minor,currency\n1,g,2026-02-31,Test,100,CAD\n2,g,2026-11-16,Test,,CAD\n3,g,2026-11-16,Test,100,ZZZ\n4,g,2026-11-16,Test,100,CAD';
  const preview = previewMappedCsv(csv, mapping, new Set());
  strictEqual(preview.errors.length, 3);
  strictEqual(preview.records.length, 1);
  const reconciliation = reconcileImpacts(preview.records, []);
  strictEqual(reconciliation.matched, false);
  strictEqual(reconciliation.missingImpactRecords, 1);
});

test('rapprochement sépare strictement groupes et devises', () => {
  const base = { sourceId: 'synthetic', date: '2026-11-16', description: 'Fictif', amountMinor: 100, splitStatus: 'undetermined' as const };
  const records = [
    { ...base, groupId: 'g1', currency: 'CAD', netImpactsMinor: { alex: 100, sam: -100 } },
    { ...base, groupId: 'g2', currency: 'CAD', netImpactsMinor: { alex: -100, sam: 100 } },
    { ...base, groupId: 'g1', currency: 'EUR', netImpactsMinor: { alex: -100, sam: 100 } },
  ];
  const result = reconcileImpacts(records, []);
  strictEqual(result.matched, false);
  strictEqual(result.differences.length, 6);
  strictEqual(result.differences.find(row => row.groupId === 'g1' && row.currency === 'CAD' && row.userId === 'alex')?.importedMinor, '100');
  strictEqual(result.differences.find(row => row.groupId === 'g2' && row.currency === 'CAD' && row.userId === 'alex')?.importedMinor, '-100');
});

test('lots natifs exacts : mapping explicite et identifiants stables, y compris doublons identiques', async () => {
  const header = 'Date,Description,Catégorie,Coût,Devise,Alice,Bob\n';
  const row = '2026-11-01,Trajet fictif,Transport,101.50,JPY,50.75,-50.75\n';
  const balance = '2026-11-16,Solde total,Total, ,JPY,101.50,-101.50';
  const source = parseNativeSplitwiseCsv(header + row + row + balance);
  const mapping = { Alice: 'alex', Bob: 'camille' };
  const first = await prepareNativeImportBatches(source, 'groupe-source', 'groupe-cible', 'JPY', mapping);
  const second = await prepareNativeImportBatches(source, 'groupe-source', 'groupe-cible', 'JPY', mapping);
  strictEqual(first.length, 1);
  strictEqual(first[0].body.records.length, 2);
  deepStrictEqual(first[0].body.records.map(record => record.sourceId), second[0].body.records.map(record => record.sourceId));
  strictEqual(first[0].body.records[0].sourceId === first[0].body.records[1].sourceId, false);
  deepStrictEqual(first[0].body.records[0], { sourceId: first[0].body.records[0].sourceId, date: '2026-11-01',
    description: 'Trajet fictif', currency: 'JPY', sourceCostExact: '101.50', sourcePrecision: 2,
    netImpactsExact: { alex: '50.75', camille: '-50.75' } });
  await rejects(prepareNativeImportBatches(source, 'groupe-source', 'groupe-cible', 'CAD', mapping));
});
