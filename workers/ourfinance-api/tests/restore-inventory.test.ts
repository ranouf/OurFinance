import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { collectLiveRestoreInventory, RestoreInventoryError } from '../src/restore-inventory';

async function fixture(role: 'owner' | 'member' = 'owner', unknownCollection = false, restoring = false, expenseCount = 1,
  failure?: 'begin' | 'missing-transaction' | 'malformed-collections' | 'malformed-members' | 'member-read' | 'rollback') {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  const root = 'projects/ourfinance-test/databases/(default)/documents';
  let rollbacks = 0;
  let readOnlyBegins = 0;
  let requests = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(resource));
    if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'synthetic-service-token' });
    requests++;
    if (url.pathname.endsWith(':beginTransaction')) {
      deepStrictEqual(JSON.parse(String(init?.body)), { options: { readOnly: {} } });
      readOnlyBegins++;
      if (failure === 'begin') return Response.json({}, { status: 503 });
      if (failure === 'missing-transaction') return Response.json({});
      return Response.json({ transaction: 'txn' });
    }
    if (url.pathname.endsWith(':rollback')) { rollbacks++; if (failure === 'rollback') throw new Error('network'); return Response.json({}); }
    const path = url.pathname.slice(`/v1/${root}/`.length);
    if (path === 'groups/g:listCollectionIds') return Response.json({ collectionIds: failure === 'malformed-collections' ? 'members' : unknownCollection ? ['expenses', 'unexpected'] : ['members', 'expenses'] });
    if (path === 'groups/g:runQuery') {
      const body = JSON.parse(String(init?.body));
      strictEqual(body.transaction, 'txn');
      const kind = body.structuredQuery.from[0].collectionId;
      return Response.json(kind === 'attachments' ? [{ document: { name: `${root}/groups/g/expenses/e/attachments/a`, fields: { publicId: { stringValue: 'ourfinance-test/g/e/a' } } } }] : []);
    }
    if (path === 'groups/g') return Response.json({ fields: { status: { stringValue: restoring ? 'restoring' : 'active' },
      ...(restoring ? { restoreId: { stringValue: '123e4567-e89b-42d3-a456-426614174000' } } : {}) } });
    if (path === 'groups/g/members/alice') return failure === 'member-read' ? Response.json({}, { status: 403 }) : Response.json({ fields: { status: { stringValue: 'active' }, role: { stringValue: role } } });
    if (path === 'groups/g/members') return Response.json({ documents: failure === 'malformed-members' ? [{ name: `${root}/groups/g/members/bad/extra` }] : [{ name: `${root}/groups/g/members/alice` }] });
    if (path === 'groups/g/expenses') {
      const start = Number(url.searchParams.get('pageToken') ?? '0');
      return Response.json({ documents: Array.from({ length: Math.min(100, expenseCount - start) }, (_, offset) => {
        const index = start + offset;
        return { name: `${root}/groups/g/expenses/${index === 0 ? 'e' : `e${index}`}` };
      }), ...(start + 100 < expenseCount ? { nextPageToken: String(start + 100) } : {}) });
    }
    if (path === 'users/alice/groupMemberships/g') return Response.json({ fields: { groupId: { stringValue: 'g' } } });
    if (path === 'users/alice/groupPreferences/g') return Response.json({}, { status: 404 });
    return Response.json({});
  };
  return { env, transport: transport as typeof fetch, get rollbacks() { return rollbacks; }, get readOnlyBegins() { return readOnlyBegins; }, get requests() { return requests; } };
}

test('owner inventories group, nested receipt and personal documents without writing', async () => {
  const state = await fixture();
  const inventory = await collectLiveRestoreInventory('alice', 'g', state.env, state.transport);
  strictEqual(inventory.groupDocuments.includes('groups/g/expenses/e/attachments/a'), true);
  deepStrictEqual(inventory.userDocuments, ['users/alice/groupMemberships/g']);
  deepStrictEqual(inventory.receiptPublicIds, ['ourfinance-test/g/e/a']);
  strictEqual(state.rollbacks, 1);
  strictEqual(state.readOnlyBegins, 1);
  strictEqual(state.requests < 50, true);
});

test('ordinary member cannot inventory the group', async () => {
  const state = await fixture('member');
  await rejects(collectLiveRestoreInventory('alice', 'g', state.env, state.transport),
    (error: unknown) => error instanceof RestoreInventoryError && error.status === 403);
  strictEqual(state.rollbacks, 1);
});

test('unknown group subcollection blocks a destructive restore inventory', async () => {
  const state = await fixture('owner', true);
  await rejects(collectLiveRestoreInventory('alice', 'g', state.env, state.transport),
    (error: unknown) => error instanceof RestoreInventoryError && error.code === 'unknown_collection');
  strictEqual(state.rollbacks, 1);
});

test('locked inventory requires the exact restore ID', async () => {
  const state = await fixture('owner', false, true);
  await rejects(collectLiveRestoreInventory('alice', 'g', state.env, state.transport),
    (error: unknown) => error instanceof RestoreInventoryError && error.status === 403);
  const result = await collectLiveRestoreInventory('alice', 'g', state.env, state.transport, '123e4567-e89b-42d3-a456-426614174000');
  strictEqual(result.groupDocuments.includes('groups/g'), true);
});

test('inventory of 51 expenses stays below the Worker Free subrequest budget', async () => {
  const state = await fixture('owner', false, false, 51);
  const result = await collectLiveRestoreInventory('alice', 'g', state.env, state.transport);
  strictEqual(result.groupDocuments.filter(path => path.startsWith('groups/g/expenses/')).length, 52);
  strictEqual(state.requests < 45, true);
});

test('inventory pages 936 synthetic expenses under the Worker Free subrequest budget', async () => {
  const state = await fixture('owner', false, false, 936);
  const result = await collectLiveRestoreInventory('alice', 'g', state.env, state.transport);
  strictEqual(result.groupDocuments.filter(path => path.startsWith('groups/g/expenses/')).length, 937);
  strictEqual(state.requests < 45, true);
});

test('inventory refuses a transaction with more than 5000 documents', async () => {
  const state = await fixture('owner', false, false, 5001);
  await rejects(collectLiveRestoreInventory('alice', 'g', state.env, state.transport),
    (error: unknown) => error instanceof RestoreInventoryError && error.code === 'inventory_too_large');
  strictEqual(state.rollbacks, 1);
});

test('inventory stops a repeated collection cursor instead of looping indefinitely', async () => {
  const state = await fixture();
  let pages = 0;
  const transport = (async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('/groups/g:listCollectionIds')) { pages++; return Response.json({ collectionIds: ['members'], nextPageToken: 'same' }); }
    return state.transport(resource, init);
  }) as typeof fetch;
  await rejects(collectLiveRestoreInventory('alice', 'g', state.env, transport),
    (error: unknown) => error instanceof RestoreInventoryError && error.code === 'inventory_too_large');
  strictEqual(pages, 100);
  strictEqual(state.rollbacks, 1);
});

test('invalid paths fail before service account access', async () => {
  const state = await fixture();
  for (const [uid, groupId, restoreId] of [['bad/uid', 'g', undefined], ['alice', 'bad/group', undefined], ['alice', 'g', 'invalid']]) {
    await rejects(collectLiveRestoreInventory(uid!, groupId!, state.env, state.transport, restoreId),
      (error: unknown) => error instanceof RestoreInventoryError && error.status === 400);
  }
  strictEqual(state.requests, 0);
});

test('transaction and inventory response failures are rejected without writes', async () => {
  for (const failure of ['begin', 'missing-transaction', 'malformed-collections', 'malformed-members', 'member-read'] as const) {
    const state = await fixture('owner', false, false, 1, failure);
    await rejects(collectLiveRestoreInventory('alice', 'g', state.env, state.transport), RestoreInventoryError);
    strictEqual(state.rollbacks, failure === 'begin' || failure === 'missing-transaction' ? 0 : 1);
  }
});

test('failed rollback after successful read leaves the inventory result available', async () => {
  const state = await fixture('owner', false, false, 1, 'rollback');
  const result = await collectLiveRestoreInventory('alice', 'g', state.env, state.transport);
  strictEqual(result.groupDocuments.includes('groups/g'), true);
  strictEqual(state.rollbacks, 1);
});

test('inventory fails closed for missing owner and malformed pages without publishing document names', async () => {
  const state = await fixture();
  const scenarios: readonly [string, Response, number, string][] = [
    ['/groups/g?transaction=', Response.json({}, { status: 404 }), 403, 'owner_required'],
    ['/groups/g/members/alice?transaction=', Response.json({}, { status: 404 }), 403, 'owner_required'],
    ['/groups/g/expenses?', Response.json({ documents: 'invalid' }), 503, 'invalid_inventory'],
    ['/groups/g/expenses?', Response.json({ documents: [{ name: 'outside/expense' }] }), 503, 'invalid_inventory'],
    ['/groups/g/expenses?', Response.json({ documents: [{ name: 'projects/ourfinance-test/databases/(default)/documents/groups/g/expenses/../escape' }] }), 503, 'invalid_inventory'],
  ];
  for (const [suffix, result, status, code] of scenarios) {
    const transport = (async (resource: string | URL | Request, init?: RequestInit) =>
      String(resource).includes(suffix) ? result.clone() : state.transport(resource, init)) as typeof fetch;
    await rejects(collectLiveRestoreInventory('alice', 'g', state.env, transport),
      (error: unknown) => error instanceof RestoreInventoryError && error.status === status && error.code === code);
  }
});
