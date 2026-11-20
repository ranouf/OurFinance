import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { listDocumentsInTransaction } from '../src/firestore-transaction-read';

test('transactional receipt query uses runQuery and keeps the bounded document list', async () => {
  const root = 'projects/ourfinance-test/databases/(default)/documents';
  const name = `${root}/groups/g/expenses/e/attachments/a`;
  const transport = (async (resource: string | URL | Request, init?: RequestInit) => {
    strictEqual(String(resource), `https://firestore.googleapis.com/v1/${root}/groups/g/expenses/e:runQuery`);
    deepStrictEqual(JSON.parse(String(init?.body)), {
      structuredQuery: { from: [{ collectionId: 'attachments' }], limit: 51 }, transaction: 'txn',
    });
    return Response.json([{ document: { name, fields: { status: { stringValue: 'active' } } } }]);
  }) as typeof fetch;
  const response = await listDocumentsInTransaction(root, 'groups/g/expenses/e', 'attachments', 'txn', {}, transport);
  strictEqual(response.status, 200);
  deepStrictEqual(await response.json(), { documents: [{ name, fields: { status: { stringValue: 'active' } } }] });
});

test('malformed query rows fail closed before any receipt mutation', async () => {
  const transport = (async () => Response.json([{ unexpected: true }])) as typeof fetch;
  const response = await listDocumentsInTransaction('projects/p/databases/(default)/documents', 'groups/g/expenses/e', 'attachments', 'txn', {}, transport);
  strictEqual(response.status, 503);
});
