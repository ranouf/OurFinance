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
