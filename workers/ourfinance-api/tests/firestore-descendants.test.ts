import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { listExpenseDescendants } from '../src/firestore-descendants';

const root = 'projects/ourfinance-test/databases/(default)/documents';

test('collection-group query pages 205 receipts in three Firestore subrequests', async () => {
  const names = Array.from({ length: 205 }, (_, index) => `${root}/groups/g/expenses/e${String(index).padStart(3, '0')}/attachments/a`);
  let calls = 0;
  const transport = async (_resource: string | URL | Request, init?: RequestInit) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    strictEqual(body.transaction, 'read-only-txn');
    strictEqual(body.structuredQuery.from[0].allDescendants, true);
    strictEqual(body.structuredQuery.from[0].collectionId, 'attachments');
    const cursor = body.structuredQuery.startAt?.values[0].referenceValue as string | undefined;
    const start = cursor ? names.findIndex(name => name > cursor) : 0;
    return Response.json(names.slice(start, start + 100).map(name => ({ document: { name, fields: {} } })));
  };
  const found = await listExpenseDescendants(root, 'g', 'attachments', 'read-only-txn', {}, transport as typeof fetch);
  strictEqual(calls, 3);
  strictEqual(found.size, 205);
  strictEqual(found.get('groups/g/expenses/e204/attachments')?.[0].name, names[204]);
});

test('descendant query refuses a result outside the selected group and a volume above its bound', async () => {
  const forged = async () => Response.json([{ document: { name: `${root}/groups/other/expenses/e/attachments/a` } }]);
  await rejects(listExpenseDescendants(root, 'g', 'attachments', 'txn', {}, forged as typeof fetch), /invalid_query/);
  const overflowing = async () => Response.json(Array.from({ length: 2 }, (_, index) => ({ document: {
    name: `${root}/groups/g/expenses/e/attachments/a${index}`,
  } })));
  await rejects(listExpenseDescendants(root, 'g', 'attachments', 'txn', {}, overflowing as typeof fetch, 1), /inventory_too_large/);
});
