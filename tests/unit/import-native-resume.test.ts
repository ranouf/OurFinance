import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { pendingNativeImportBatches, prepareNativeImportBatches } from '../../src/app/features/import-export/prepare-batch';
import { parseNativeSplitwiseCsv } from '../../src/app/features/import-export/splitwise-native-csv';

test('reprend les lignes manquantes et distingue les sources actives des sources annulées', async () => {
  const transactions = Array.from({ length: 11 }, (_, index) =>
    `2026-11-${String(index + 1).padStart(2, '0')},Dépense fictive ${index + 1},Restaurant,2.00,CAD,1.00,-1.00`);
  const csv = ['Date,Description,Catégorie,Coût,Devise,Alice fictive,Bob fictif', ...transactions,
    '2026-11-16,Solde total,Total, ,CAD,11.00,-11.00'].join('\n');
  const source = parseNativeSplitwiseCsv(csv);
  const batches = await prepareNativeImportBatches(source, 'source-fictive', 'cible-fictive', 'CAD',
    { 'Alice fictive': 'membre-a', 'Bob fictif': 'membre-b' });
  deepStrictEqual(batches.map(batch => batch.body.records.length), [10, 1]);

  const firstBatchSourceIds = new Set(batches[0].body.records.map(record => record.sourceId));
  const resumed = pendingNativeImportBatches(batches, firstBatchSourceIds);
  strictEqual(resumed.alreadyImported, 10);
  deepStrictEqual(resumed.pending.map(batch => batch.body.records.length), [1]);
  strictEqual(resumed.pending[0].body.records[0].sourceId, batches[1].body.records[0].sourceId);
  deepStrictEqual(batches.map(batch => batch.body.records.length), [10, 1]);

  const complete = pendingNativeImportBatches(batches, new Set(batches.flatMap(batch => batch.body.records.map(record => record.sourceId))));
  strictEqual(complete.alreadyImported, 11);
  strictEqual(complete.alreadyUndone, 0);
  strictEqual(complete.pending.length, 0);

  const allSourceIds = new Set(batches.flatMap(batch => batch.body.records.map(record => record.sourceId)));
  const allUndone = pendingNativeImportBatches(batches, allSourceIds, allSourceIds);
  strictEqual(allUndone.alreadyImported, 0);
  strictEqual(allUndone.alreadyUndone, 11);
  strictEqual(allUndone.pending.length, 0);

  const activeId = batches[0].body.records[0].sourceId;
  const undoneId = batches[0].body.records[1].sourceId;
  const mixed = pendingNativeImportBatches(batches, new Set([activeId, undoneId]), new Set([undoneId]));
  strictEqual(mixed.alreadyImported, 1);
  strictEqual(mixed.alreadyUndone, 1);
  strictEqual(mixed.pending.reduce((count, batch) => count + batch.body.records.length, 0), 9);
});

test('un alias ou remapping ne crée pas une nouvelle provenance native', async () => {
  const csv = ['Date,Description,Catégorie,Coût,Devise,Alice fictive,Bob fictif',
    '2026-11-01,Dépense fictive,Restaurant,02.00,CAD,1.00,-1.00',
    '2026-11-02,Solde total,Total, ,CAD,1.00,-1.00'].join('\n');
  const source = parseNativeSplitwiseCsv(csv);
  const first = await prepareNativeImportBatches(source, 'source-a', 'cible-fictive', 'CAD',
    { 'Alice fictive': 'membre-a', 'Bob fictif': 'membre-b' });
  const other = await prepareNativeImportBatches(source, 'source-b', 'cible-fictive', 'CAD',
    { 'Alice fictive': 'membre-c', 'Bob fictif': 'membre-d' });
  const firstId = first[0].body.records[0].sourceId;
  strictEqual(other[0].body.records[0].sourceId, firstId);
  strictEqual(firstId, `native_${createHash('sha256').update(JSON.stringify([
    '2026-11-01', 'Dépense fictive', 'Restaurant', 'CAD', '2', 0,
  ])).digest('hex')}`);
  const pending = pendingNativeImportBatches(other, new Set([firstId]));
  strictEqual(pending.alreadyImported, 1);
  strictEqual(pending.pending.length, 0);
  const row = other[0].body.records[0];
  if (!('sourceCategory' in row)) throw new Error('Ligne native attendue');
  deepStrictEqual({ category: row.sourceCategory, occurrence: row.sourceOccurrence },
    { category: 'Restaurant', occurrence: 0 });
});

test('deux lignes canoniques identiques conservent leurs deux occurrences', async () => {
  const csv = ['Date,Description,Catégorie,Coût,Devise,Alice fictive,Bob fictif',
    '2026-11-01,Dépense fictive,Restaurant,2.00,CAD,1.00,-1.00',
    '2026-11-01,Dépense fictive,Restaurant,02.0,CAD,1.00,-1.00',
    '2026-11-02,Solde total,Total, ,CAD,2.00,-2.00'].join('\n');
  const batches = await prepareNativeImportBatches(parseNativeSplitwiseCsv(csv), 'source-a', 'cible-fictive', 'CAD',
    { 'Alice fictive': 'membre-a', 'Bob fictif': 'membre-b' });
  deepStrictEqual(batches[0].body.records.map(record => 'sourceOccurrence' in record ? record.sourceOccurrence : -1), [0, 1]);
  strictEqual(batches[0].body.records[0].sourceId === batches[0].body.records[1].sourceId, false);
});
