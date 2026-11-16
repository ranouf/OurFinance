import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { readFileSync } from 'node:fs';
import { previewMappedCsv } from '../../src/app/features/import-export/import-v1';
import { prepareImportBatch } from '../../src/app/features/import-export/prepare-batch';

const mapping = { sourceId: 'Source ID', groupId: 'Group ID', date: 'Date', description: 'Description', amountMinor: 'Amount Minor', currency: 'Currency' };
const impacts = { alex: 'Alex Exemple', camille: 'Camille Exemple', sam: 'Sam Exemple' };
const csv = readFileSync('tests/fixtures/splitwise-synthetique.csv', 'utf8');
const preview = previewMappedCsv(csv, mapping, new Set(), impacts);
const batchId = '01234567-89ab-4def-8abc-0123456789ab';
const memberMapping = { alex: 'member_a', camille: 'member_b', sam: 'member_c' };

test('maps a complete synthetic CSV preview to the Worker payload without inventing shares', () => {
  const result = prepareImportBatch(preview, 'groupe-test', 'target_group', memberMapping, batchId);
  strictEqual(result.groupId, 'target_group');
  strictEqual(result.body.records.length, 3);
  deepStrictEqual(result.body.records[0].netImpactsMinor, { member_a: 4000, member_b: -2000, member_c: -2000 });
  strictEqual(result.body.records.reduce((sum, row) => sum + row.netImpactsMinor.member_a, 0), 1500);
  strictEqual(JSON.stringify(result).includes('allocations'), false);
  strictEqual(JSON.stringify(result).includes('payments'), false);
});

test('refuses preview errors, duplicates, missing impacts and mixed source groups', () => {
  const prepare = (value: typeof preview) => prepareImportBatch(value, 'groupe-test', 'target_group', memberMapping, batchId);
  throws(() => prepare({ ...preview, errors: ['ligne invalide'] }));
  throws(() => prepare({ ...preview, duplicateIds: ['synthetic-001'] }));
  throws(() => prepare({ ...preview, records: [{ ...preview.records[0], netImpactsMinor: undefined }] }));
  throws(() => prepare({ ...preview, records: [{ ...preview.records[0], netImpactsMinor: { alex: 1, camille: 0, sam: 0 } }] }));
  throws(() => prepare({ ...preview, records: [{ ...preview.records[0], groupId: 'autre-groupe' }] }));
  throws(() => prepare({ ...preview, records: Array.from({ length: 11 }, () => preview.records[0]) }));
});

test('refuses missing, duplicate or malformed member mapping', () => {
  throws(() => prepareImportBatch(preview, 'groupe-test', 'target_group', { alex: 'member_a' }, batchId));
  throws(() => prepareImportBatch(preview, 'groupe-test', 'target_group', { ...memberMapping, sam: 'member_a' }, batchId));
  throws(() => prepareImportBatch(preview, 'groupe-test', 'target_group', { ...memberMapping, sam: 'bad/id' }, batchId));
  throws(() => prepareImportBatch(preview, 'groupe-test', 'target_group', memberMapping, 'not-a-uuid'));
  const inheritedName = { ...preview, records: [{ ...preview.records[0], netImpactsMinor: Object.fromEntries([['toString', 0], ['alex', 0]]) }] };
  throws(() => prepareImportBatch(inheritedName, 'groupe-test', 'target_group', memberMapping, batchId));
});
