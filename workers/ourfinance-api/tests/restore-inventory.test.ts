import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { collectLiveRestoreInventory, RestoreInventoryError } from '../src/restore-inventory';

async function fixture(role: 'owner' | 'member' = 'owner', unknownCollection = false, restoring = false) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  const root = 'projects/ourfinance-test/databases/(default)/documents';
  let rollbacks = 0;
  const transport = async (resource: string | URL | Request) => {
    const url = new URL(String(resource));
    if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'synthetic-service-token' });
    if (url.pathname.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.pathname.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    const path = url.pathname.slice(`/v1/${root}/`.length);
    if (path === 'groups/g:listCollectionIds') return Response.json({ collectionIds: unknownCollection ? ['expenses', 'unexpected'] : ['members', 'expenses'] });
    if (path === 'groups/g/expenses/e:listCollectionIds') return Response.json({ collectionIds: ['attachments'] });
    if (path === 'groups/g') return Response.json({ fields: { status: { stringValue: restoring ? 'restoring' : 'active' },
      ...(restoring ? { restoreId: { stringValue: '123e4567-e89b-42d3-a456-426614174000' } } : {}) } });
    if (path === 'groups/g/members/alice') return Response.json({ fields: { status: { stringValue: 'active' }, role: { stringValue: role } } });
    if (path === 'groups/g/members') return Response.json({ documents: [{ name: `${root}/groups/g/members/alice` }] });
    if (path === 'groups/g/expenses') return Response.json({ documents: [{ name: `${root}/groups/g/expenses/e` }] });
    if (path === 'groups/g/expenses/e/attachments') return Response.json({ documents: [{ name: `${root}/groups/g/expenses/e/attachments/a`, fields: { publicId: { stringValue: 'ourfinance-test/g/e/a' } } }] });
    if (path === 'users/alice/groupMemberships/g') return Response.json({ fields: { groupId: { stringValue: 'g' } } });
    if (path === 'users/alice/groupPreferences/g') return Response.json({}, { status: 404 });
    return Response.json({});
  };
  return { env, transport: transport as typeof fetch, get rollbacks() { return rollbacks; } };
}

test('owner inventories group, nested receipt and personal documents without writing', async () => {
  const state = await fixture();
  const inventory = await collectLiveRestoreInventory('alice', 'g', state.env, state.transport);
  strictEqual(inventory.groupDocuments.includes('groups/g/expenses/e/attachments/a'), true);
  deepStrictEqual(inventory.userDocuments, ['users/alice/groupMemberships/g']);
  deepStrictEqual(inventory.receiptPublicIds, ['ourfinance-test/g/e/a']);
  strictEqual(state.rollbacks, 1);
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
