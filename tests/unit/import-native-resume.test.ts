import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { pendingNativeImportBatches, prepareNativeImportBatches } from '../../src/app/features/import-export/prepare-batch';
import { parseNativeSplitwiseCsv } from '../../src/app/features/import-export/splitwise-native-csv';

test('reprend seulement la ligne manquante après un premier lot natif de dix lignes', async () => {
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
  strictEqual(complete.pending.length, 0);
});
