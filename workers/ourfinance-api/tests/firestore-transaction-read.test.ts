import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { listCollectionPageInTransaction, listDocumentsInTransaction, readDocumentInTransaction } from '../src/firestore-transaction-read';

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

test('empty transactional receipt query returns no documents', async () => {
  const transport = (async () => Response.json([{ readTime: '2026-11-20T00:00:00Z' }])) as typeof fetch;
  const response = await listDocumentsInTransaction('projects/p/databases/(default)/documents', 'groups/g/expenses/e', 'attachments', 'txn', {}, transport);
  strictEqual(response.status, 200);
  deepStrictEqual(await response.json(), { documents: [] });
});

test('transactional receipt query propagates Firestore refusal', async () => {
  const transport = (async () => Response.json({ error: 'denied' }, { status: 403 })) as typeof fetch;
  const response = await listDocumentsInTransaction('projects/p/databases/(default)/documents', 'groups/g/expenses/e', 'attachments', 'txn', {}, transport);
  strictEqual(response.status, 403);
});

test('transactional receipt query rejects malformed envelopes and missing documents', async () => {
  for (const body of [{ documents: [] }, [null], [{}], [{ document: null }]]) {
    const transport = (async () => Response.json(body)) as typeof fetch;
    const response = await listDocumentsInTransaction('projects/p/databases/(default)/documents', 'groups/g/expenses/e', 'attachments', 'txn', {}, transport);
    strictEqual(response.status, 503);
  }
});

test('transactional collection pagination uses a document cursor', async () => {
  const root = 'projects/p/databases/(default)/documents';
  const first = `${root}/groups/g/expenses/e1`;
  const second = `${root}/groups/g/expenses/e2`;
  const bodies: Record<string, unknown>[] = [];
  const transport = (async (resource: string | URL | Request, init?: RequestInit) => {
    strictEqual(String(resource), `https://firestore.googleapis.com/v1/${root}/groups/g:runQuery`);
    strictEqual(new Headers(init?.headers).get('Content-Type'), 'application/json');
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return Response.json(bodies.length === 1 ? [{ document: { name: first } }] : [{ document: { name: second } }]);
  }) as typeof fetch;
  const firstPage = await listCollectionPageInTransaction(root, 'groups/g/expenses', 1, 'txn', {}, transport);
  deepStrictEqual(await firstPage.json(), { documents: [{ name: first }], nextPageToken: first });
  const lastPage = await listCollectionPageInTransaction(root, 'groups/g/expenses', 2, 'txn', {}, transport, first);
  deepStrictEqual(await lastPage.json(), { documents: [{ name: second }] });
  deepStrictEqual(bodies[1]['structuredQuery'], {
    from: [{ collectionId: 'expenses' }], orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 2,
    startAt: { values: [{ referenceValue: first }], before: false },
  });
});

test('transactional collection pagination rejects an unrelated cursor and invalid response', async () => {
  const root = 'projects/p/databases/(default)/documents';
  const transport = (async () => Response.json({ invalid: true })) as typeof fetch;
  const invalidCursor = await listCollectionPageInTransaction(root, 'groups/g/expenses', 100, 'txn', {}, transport, 'outside/expense');
  strictEqual(invalidCursor.status, 503);
  const invalidResponse = await listCollectionPageInTransaction(root, 'groups/g/expenses', 100, 'txn', {}, transport);
  strictEqual(invalidResponse.status, 503);
});

test('transactional collection pagination rejects invalid bounds without a request', async () => {
  const transport = (async () => { throw new Error('No request expected'); }) as typeof fetch;
  const root = 'projects/p/databases/(default)/documents';
  for (const [path, size] of [['groups', 100], ['groups/g/expenses', 0], ['groups/g/expenses', 101], ['groups/g/expenses', 1.5]] as const) {
    const response = await listCollectionPageInTransaction(root, path, size, 'txn', {}, transport);
    strictEqual(response.status, 503);
  }
});

test('transactional collection pagination propagates refusal and rejects malformed rows', async () => {
  const root = 'projects/p/databases/(default)/documents';
  const request = (result: unknown, status = 200) => listCollectionPageInTransaction(root, 'groups/g/expenses', 100, 'txn', {},
    (async () => Response.json(result, { status })) as typeof fetch);
  strictEqual((await request({ error: 'denied' }, 403)).status, 403);
  for (const result of [[null], [{}], [{ document: null }], [{ document: {} }]]) {
    strictEqual((await request(result)).status, 503);
  }
  const empty = await request([{ readTime: '2026-11-20T00:00:00Z' }]);
  deepStrictEqual(await empty.json(), { documents: [] });
});

test('transactional document reader accepts a single Firestore result object', async () => {
  const root = 'projects/p/databases/(default)/documents';
  const name = `${root}/groups/g`;
  const transport = (async () => Response.json({ found: { name, fields: { status: { stringValue: 'active' } } } })) as typeof fetch;
  const response = await readDocumentInTransaction(root, 'groups/g', 'txn', {}, transport);
  strictEqual(response.status, 200);
  deepStrictEqual(await response.json(), { name, fields: { status: { stringValue: 'active' } } });
});
