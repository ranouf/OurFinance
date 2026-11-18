import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert';
import { createHash } from 'node:crypto';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createImportBatch, ImportError, parseImportBatch, undoImportBatch } from '../src/import-batches';

const groupId = 'synthetic-group';
const batchId = '123e4567-e89b-42d3-a456-426614174011';
const input = { batchId, records: [
  { sourceId: 'synthetic-001', date: '2026-10-01', description: 'Épicerie fictive', currency: 'CAD', amountMinor: 6000, netImpactsMinor: { alex: 4000, camille: -2000, sam: -2000 } },
  { sourceId: 'synthetic-002', date: '2026-10-03', description: 'Transport fictif', currency: 'CAD', amountMinor: 3000, netImpactsMinor: { alex: -1000, camille: 2000, sam: -1000 } },
] };

type Fields = Record<string, any>;
async function fixture(revoked = false) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const docs = new Map<string, Fields>([['groups/synthetic-group', { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } }]]);
  for (const id of ['alex', 'camille', 'sam']) docs.set(`groups/${groupId}/members/${id}`, { status: { stringValue: revoked && id === 'sam' ? 'revoked' : 'active' }, role: { stringValue: id === 'alex' ? 'owner' : 'member' } });
  let commits = 0, rollbacks = 0;
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-access' });
    strictEqual(new Headers(options?.headers).get('Authorization'), 'Bearer synthetic-access');
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'synthetic-transaction' });
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.endsWith(':commit')) {
      const writes = JSON.parse(String(options?.body)).writes as any[];
      if (writes.some(write => write.currentDocument?.exists === false && docs.has(String(write.update.name).split('/documents/')[1]))) return Response.json({}, { status: 409 });
      for (const write of writes) {
        const path = String(write.update.name).split('/documents/')[1];
        docs.set(path, { ...(write.updateMask ? docs.get(path) : {}), ...write.update.fields });
      }
      commits++;
      return Response.json({ writeResults: writes.map(() => ({})) });
    }
    const path = url.split('/documents/')[1]?.split('?')[0];
    const fields = docs.get(path);
    return fields ? Response.json({ fields }) : new Response(null, { status: 404 });
  };
  return { env, docs, transport: transport as typeof fetch, commits: () => commits, rollbacks: () => rollbacks };
}

test('server rejects invented or unbalanced historical impacts', () => {
  throws(() => parseImportBatch({ ...input, records: [{ ...input.records[0], netImpactsMinor: { alex: 4000, camille: -1000 } }] }, groupId), ImportError);
  throws(() => parseImportBatch({ ...input, records: [{ ...input.records[0], date: '2026-02-31' }] }, groupId), ImportError);
  throws(() => parseImportBatch({ ...input, records: [input.records[0], input.records[0]] }, groupId), ImportError);
});

test('synthetic batch persists impacts without inferred payments and can be undone', async () => {
  const f = await fixture();
  deepStrictEqual(await createImportBatch(input, 'alex', groupId, f.env, f.transport), { batchId, recordCount: 2 });
  strictEqual(f.commits(), 1);
  const records = [...f.docs.entries()].filter(([path]) => path.includes('/importedRecords/'));
  strictEqual(records.length, 2);
  strictEqual(records.every(([, data]) => data.splitStatus.stringValue === 'undetermined' && !data.payments && !data.allocations), true);
  strictEqual(f.docs.get(`users/alex/importBatches/${batchId}`)?.status.stringValue, 'active');
  strictEqual(typeof f.docs.get(`groups/${groupId}`)?.currencyLockedAt?.timestampValue, 'string');
  await undoImportBatch(batchId, 'alex', groupId, f.env, f.transport);
  strictEqual(f.commits(), 2);
  strictEqual(records.every(([path]) => f.docs.get(path)?.status.stringValue === 'undone'), true);
  strictEqual(f.docs.get(`users/alex/importBatches/${batchId}`)?.status.stringValue, 'undone');
  await rejects(undoImportBatch(batchId, 'alex', groupId, f.env, f.transport), (error: unknown) => error instanceof ImportError && error.status === 403);
  strictEqual(f.rollbacks(), 1);
});

test('same source cannot be reimported; revoked member cannot start a batch', async () => {
  const f = await fixture();
  await createImportBatch(input, 'alex', groupId, f.env, f.transport);
  await rejects(createImportBatch({ ...input, batchId: '123e4567-e89b-42d3-a456-426614174012' }, 'alex', groupId, f.env, f.transport), (error: unknown) => error instanceof ImportError && error.status === 409);
  strictEqual(f.rollbacks(), 1);
  const revoked = await fixture(true);
  await rejects(createImportBatch(input, 'alex', groupId, revoked.env, revoked.transport), (error: unknown) => error instanceof ImportError && error.status === 403);
  strictEqual(revoked.commits(), 0);
  strictEqual(revoked.rollbacks(), 1);
  const ordinary = await fixture();
  await rejects(createImportBatch(input, 'camille', groupId, ordinary.env, ordinary.transport), (error: unknown) => error instanceof ImportError && error.code === 'owner_required');
  strictEqual(ordinary.commits(), 0);
});

test('a mixed-currency import is rejected without writing any record', async () => {
  const f = await fixture();
  const mixed = { ...input, records: [input.records[0], { ...input.records[1], currency: 'JPY' }] };
  await rejects(createImportBatch(mixed, 'alex', groupId, f.env, f.transport), (error: unknown) => error instanceof ImportError && error.code === 'currency_mismatch');
  strictEqual(f.commits(), 0);
  strictEqual(f.rollbacks(), 1);
});

function nativeId(category: string, occurrence = 0): string {
  return `native_${createHash('sha256').update(JSON.stringify([
    '2026-11-01', 'Trajet fictif', category, 'JPY', '101.5', occurrence,
  ])).digest('hex')}`;
}
const exactInput = { batchId, records: [{
  sourceId: nativeId('Transport'), date: '2026-11-01', description: 'Trajet fictif', currency: 'JPY',
  sourceCategory: 'Transport', sourceOccurrence: 0,
  sourceCostExact: '101.50', sourcePrecision: 2, netImpactsExact: { alex: '50.75', camille: '-50.75' },
}] };

test('historical fractions are stored as exact strings and can be undone', async () => {
  const f = await fixture();
  f.docs.get(`groups/${groupId}`)!.currencyCode.stringValue = 'JPY';
  deepStrictEqual(await createImportBatch(exactInput, 'alex', groupId, f.env, f.transport), { batchId, recordCount: 1 });
  const record = [...f.docs.entries()].find(([path]) => path.includes('/importedRecords/'))?.[1];
  strictEqual(record?.sourceCostExact.stringValue, '101.50');
  strictEqual(record?.sourcePrecision.integerValue, '2');
  strictEqual(record?.netImpactsExact.mapValue.fields.alex.stringValue, '50.75');
  strictEqual(record?.amountMinor, undefined);
  strictEqual(record?.netImpactsMinor, undefined);
  await rejects(createImportBatch({ ...exactInput, batchId: '123e4567-e89b-42d3-a456-426614174012' }, 'alex', groupId, f.env, f.transport),
    (error: unknown) => error instanceof ImportError && error.status === 409);
  await undoImportBatch(batchId, 'alex', groupId, f.env, f.transport);
  strictEqual(f.commits(), 2);
});

test('native provenance refuses an alias-derived ID and keeps an undone source reserved', async () => {
  const f = await fixture();
  f.docs.get(`groups/${groupId}`)!.currencyCode.stringValue = 'JPY';
  await rejects(createImportBatch({ ...exactInput, records: [{ ...exactInput.records[0], sourceId: 'native_alias_changed' }] },
    'alex', groupId, f.env, f.transport), (error: unknown) => error instanceof ImportError && error.code === 'invalid_native_source');
  strictEqual(f.commits(), 0);
  await createImportBatch(exactInput, 'alex', groupId, f.env, f.transport);
  await undoImportBatch(batchId, 'alex', groupId, f.env, f.transport);
  await rejects(createImportBatch({ ...exactInput, batchId: '123e4567-e89b-42d3-a456-426614174012' },
    'alex', groupId, f.env, f.transport), (error: unknown) => error instanceof ImportError && error.status === 409);
});

test('identical native rows use an occurrence to retain both legitimate rows', async () => {
  const f = await fixture();
  f.docs.get(`groups/${groupId}`)!.currencyCode.stringValue = 'JPY';
  const second = { ...exactInput.records[0], sourceId: nativeId('Transport', 1), sourceOccurrence: 1 };
  await createImportBatch({ ...exactInput, records: [...exactInput.records, second] }, 'alex', groupId, f.env, f.transport);
  strictEqual([...f.docs.keys()].filter(path => path.includes('/importedRecords/')).length, 2);
});

test('historical exact import refuses a revoked participant before writing', async () => {
  const f = await fixture();
  f.docs.get(`groups/${groupId}`)!.currencyCode.stringValue = 'JPY';
  f.docs.get(`groups/${groupId}/members/camille`)!.status.stringValue = 'revoked';
  await rejects(createImportBatch(exactInput, 'alex', groupId, f.env, f.transport),
    (error: unknown) => error instanceof ImportError && error.status === 403);
  strictEqual(f.commits(), 0);
});

test('exact historical variant refuses rounding, imbalance and mixed representation', () => {
  const row = exactInput.records[0];
  for (const invalid of [
    { ...row, sourcePrecision: 0 },
    { ...row, sourceCostExact: '1'.repeat(31) },
    { ...row, netImpactsExact: { alex: '50.75', camille: '-50.74' } },
    { ...row, amountMinor: 102 },
    { ...row, netImpactsMinor: { alex: 51, camille: -51 } },
    { ...row, sourceOccurrence: -1 },
    { ...row, sourceCategory: null },
  ]) throws(() => parseImportBatch({ batchId, records: [invalid] }, groupId), ImportError);
});
