import { withBatchGet } from './batch-get-mock';
import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { abortRestoreLock, beginPreparedRestoreLock, beginRestoreLock, RestoreLockError } from '../src/restore-lock';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';

async function fixture(role: 'owner' | 'member' = 'owner') {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  let status = 'active';
  let pendingCleanupRestoreId: string | undefined;
  let commits = 0;
  let rollbacks = 0;
  let jobFields: Record<string, unknown> = {};
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.includes('/groups/g/members/alice?')) return Response.json({ fields: { status: { stringValue: 'active' }, role: { stringValue: role } } });
    if (url.includes(`/groups/g/restoreJobs/${restoreId}?`)) return Response.json({ fields: { ownerId: { stringValue: 'alice' }, status: { stringValue: 'staging' }, newPublicIds: { arrayValue: { values: [] } } } });
    if (url.includes('/groups/g?')) return Response.json({ fields: { status: { stringValue: status }, currencyCode: { stringValue: 'CAD' },
      ...(pendingCleanupRestoreId ? { pendingCleanupRestoreId: { stringValue: pendingCleanupRestoreId } } : {}),
      ...(status === 'restoring' ? { restoreId: { stringValue: restoreId }, restoreOwnerId: { stringValue: 'alice' } } : {}) } });
    if (url.endsWith(':commit')) {
      commits++;
      const body = JSON.parse(String(init?.body));
      strictEqual(body.writes.length, 2);
      strictEqual(body.writes[1].update.name.endsWith(`/groups/g/restoreJobs/${restoreId}`), true);
      jobFields = body.writes[1].update.fields;
      status = body.writes[0].update.fields.status.stringValue;
      pendingCleanupRestoreId = body.writes[0].update.fields.pendingCleanupRestoreId?.stringValue;
      return Response.json({});
    }
    throw new Error('Requête inattendue');
  };
  return { env, transport: withBatchGet(transport), get status() { return status; }, get pendingCleanupRestoreId() { return pendingCleanupRestoreId; },
    get commits() { return commits; }, get rollbacks() { return rollbacks; }, get jobFields() { return jobFields; } };
}

test('owner locks original group and can abort before replacing documents', async () => {
  const state = await fixture();
  await beginRestoreLock('alice', 'g', restoreId, 'CAD', [], state.env, state.transport);
  strictEqual(state.status, 'restoring');
  await abortRestoreLock('alice', 'g', restoreId, state.env, state.transport);
  strictEqual(state.status, 'active');
  strictEqual(state.pendingCleanupRestoreId, restoreId);
  strictEqual(state.commits, 2);
  await rejects(beginRestoreLock('alice', 'g', '223e4567-e89b-42d3-a456-426614174000', 'CAD', [], state.env, state.transport),
    (error: unknown) => error instanceof RestoreLockError && error.status === 409);
});

test('ordinary member cannot lock a group and transaction rolls back', async () => {
  const state = await fixture('member');
  await rejects(beginRestoreLock('alice', 'g', restoreId, 'CAD', [], state.env, state.transport),
    (error: unknown) => error instanceof RestoreLockError && error.status === 403);
  strictEqual(state.commits, 0);
  strictEqual(state.rollbacks, 1);
});

test('prepared restore records 30 exact receipt digests without uploading media', async () => {
  const state = await fixture();
  const ids = Array.from({ length: 30 }, (_, index) => `ourfinance-test/g/e/restore_${restoreId}/a_${index}`);
  const digests = ids.map(() => 'a'.repeat(64));
  await beginPreparedRestoreLock('alice', 'g', restoreId, 'CAD', ids,
    { manifestSha256: 'b'.repeat(64), receiptSha256: digests, receiptFormats: ids.map(() => 'png') }, state.env, state.transport);
  strictEqual(state.commits, 1);
  strictEqual(state.status, 'restoring');
  strictEqual((state.jobFields['manifestSha256'] as { stringValue: string }).stringValue, 'b'.repeat(64));
  strictEqual((state.jobFields['receiptSha256'] as { arrayValue: { values: unknown[] } }).arrayValue.values.length, 30);
});
