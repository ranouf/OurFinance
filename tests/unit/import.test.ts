import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { parseCsv } from '../../src/app/features/import-export/csv';
import { previewMappedCsv } from '../../src/app/features/import-export/import-v1';
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
});
