import { withBatchGet } from './batch-get-mock';
import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { readCurrentRestore, RestoreCurrentError } from '../src/restore-current';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';

async function fixture(options: { groupStatus?: string; memberStatus?: string; role?: string; jobStatus?: string;
  restoreOwnerId?: string; jobOwnerId?: string; lastRestoreId?: string; pendingCleanupRestoreId?: string; missingJob?: boolean;
  groupOwnerId?: string; beginEmpty?: boolean; readStatus?: number; rollbackThrows?: boolean } = {}) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  let rollbacks = 0;
  let jobReads = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer service-token');
    if (url.endsWith(':beginTransaction')) {
      deepStrictEqual(JSON.parse(String(init?.body)), { options: { readOnly: {} } });
      return Response.json(options.beginEmpty ? {} : { transaction: 'txn' });
    }
    if (url.endsWith(':rollback')) { rollbacks++; if (options.rollbackThrows) throw new Error('network'); return Response.json({}); }
    if (options.readStatus) return Response.json({}, { status: options.readStatus });
    if (url.includes('/groups/group-a/members/alice?')) return Response.json({ fields: {
      role: { stringValue: options.role ?? 'owner' }, status: { stringValue: options.memberStatus ?? 'active' },
    } });
    if (url.includes('/groups/group-a/restoreJobs/')) {
      jobReads++;
      if (options.missingJob) return new Response(null, { status: 404 });
      return Response.json({ fields: { ownerId: { stringValue: options.jobOwnerId ?? 'alice' },
        status: { stringValue: options.jobStatus ?? 'staging' },
        manifestSha256: { stringValue: 'a'.repeat(64) }, newPublicIds: { arrayValue: { values: [{ stringValue: 'private-asset' }] } },
      } });
    }
    if (url.includes('/groups/group-a?')) return Response.json({ fields: {
      ownerId: { stringValue: options.groupOwnerId ?? 'alice' }, status: { stringValue: options.groupStatus ?? 'restoring' },
      restoreId: { stringValue: restoreId }, restoreOwnerId: { stringValue: options.restoreOwnerId ?? 'alice' },
      ...(options.lastRestoreId ? { lastRestoreId: { stringValue: options.lastRestoreId } } : {}),
      ...(options.pendingCleanupRestoreId ? { pendingCleanupRestoreId: { stringValue: options.pendingCleanupRestoreId } } : {}),
    } });
    throw new Error(`Unexpected request: ${url}`);
  };
  return { env, transport: withBatchGet(transport), get rollbacks() { return rollbacks; }, get jobReads() { return jobReads; } };
}

test('owner can recover only a staging restore ID, without archive or media details', async () => {
  const state = await fixture();
  const result = await readCurrentRestore('alice', 'group-a', state.env, state.transport);
  deepStrictEqual(result, { status: 'staging', restoreId });
  strictEqual(JSON.stringify(result).includes('private-asset'), false);
  strictEqual(state.rollbacks, 1);
});

test('restore state reports a Firestore quota refusal without exposing its body', async () => {
  const state = await fixture();
  const transport = async (input: string | URL | Request, init?: RequestInit) => String(input).endsWith(':beginTransaction')
    ? Response.json({ message: 'private provider detail' }, { status: 429 })
    : state.transport(input, init);
  await rejects(readCurrentRestore('alice', 'group-a', state.env, withBatchGet(transport)),
    (error: unknown) => error instanceof RestoreCurrentError && error.status === 503 && error.code === 'provider_quota_exceeded');
});

test('ordinary or revoked member cannot discover a restore ID', async () => {
  for (const options of [{ role: 'member' }, { memberStatus: 'revoked' }]) {
    const state = await fixture(options);
    await rejects(readCurrentRestore('alice', 'group-a', state.env, state.transport),
      (error: unknown) => error instanceof RestoreCurrentError && error.status === 403);
    strictEqual(state.jobReads, 0);
    strictEqual(state.rollbacks, 1);
  }
});

test('wrong restore owner or inconsistent job is rejected', async () => {
  for (const options of [{ restoreOwnerId: 'other' }, { jobOwnerId: 'other' }, { jobStatus: 'completed' }]) {
    const state = await fixture(options);
    await rejects(readCurrentRestore('alice', 'group-a', state.env, state.transport),
      (error: unknown) => error instanceof RestoreCurrentError && error.status === 409);
    strictEqual(state.rollbacks, 1);
  }
});

test('active group reports pending cleanup only for a matching restore job', async () => {
  const state = await fixture({ groupStatus: 'active', lastRestoreId: restoreId, jobStatus: 'cleanup_pending' });
  deepStrictEqual(await readCurrentRestore('alice', 'group-a', state.env, state.transport), { status: 'cleanup_pending', restoreId });
  strictEqual(state.rollbacks, 1);
});

test('active group without a restore job reports only active', async () => {
  const state = await fixture({ groupStatus: 'active' });
  deepStrictEqual(await readCurrentRestore('alice', 'group-a', state.env, state.transport), { status: 'active' });
  strictEqual(state.jobReads, 0);
  strictEqual(state.rollbacks, 1);
});

test('a pruned completed journal does not block an active group', async () => {
  const state = await fixture({ groupStatus: 'active', lastRestoreId: restoreId, missingJob: true });
  deepStrictEqual(await readCurrentRestore('alice', 'group-a', state.env, state.transport), { status: 'active' });
  strictEqual(state.jobReads, 1);
  strictEqual(state.rollbacks, 1);
});

test('owner can recover aborted cleanup after losing the tab, even when the job is completed but marker remains', async () => {
  for (const jobStatus of ['cleanup_pending', 'completed']) {
    const state = await fixture({ groupStatus: 'active', pendingCleanupRestoreId: restoreId, jobStatus });
    deepStrictEqual(await readCurrentRestore('alice', 'group-a', state.env, state.transport), { status: 'cleanup_pending', restoreId });
    strictEqual(state.rollbacks, 1);
  }
});

test('current state rejects invalid path, missing transaction and unreadable Firestore documents', async () => {
  const state = await fixture();
  await rejects(readCurrentRestore('bad/uid', 'group-a', state.env, state.transport), RestoreCurrentError);
  await rejects(readCurrentRestore('alice', 'bad/group', state.env, state.transport), RestoreCurrentError);
  strictEqual(state.rollbacks, 0);
  const empty = await fixture({ beginEmpty: true });
  await rejects(readCurrentRestore('alice', 'group-a', empty.env, empty.transport), RestoreCurrentError);
  strictEqual(empty.rollbacks, 0);
  const unreadable = await fixture({ readStatus: 503 });
  await rejects(readCurrentRestore('alice', 'group-a', unreadable.env, unreadable.transport), RestoreCurrentError);
  strictEqual(unreadable.rollbacks, 1);
});

test('current state refuses wrong owner, invalid marker and mismatched cleanup journal', async () => {
  for (const options of [
    { groupOwnerId: 'other' }, { groupStatus: 'archived' },
    { groupStatus: 'active', pendingCleanupRestoreId: 'invalid' },
    { groupStatus: 'active', pendingCleanupRestoreId: restoreId, jobStatus: 'staging' },
    { groupStatus: 'active', lastRestoreId: 'invalid' },
  ]) {
    const state = await fixture(options);
    await rejects(readCurrentRestore('alice', 'group-a', state.env, state.transport), RestoreCurrentError);
    strictEqual(state.rollbacks, 1);
  }
});

test('completed job and failed rollback leave active state available', async () => {
  const state = await fixture({ groupStatus: 'active', lastRestoreId: restoreId, jobStatus: 'completed', rollbackThrows: true });
  deepStrictEqual(await readCurrentRestore('alice', 'group-a', state.env, state.transport), { status: 'active' });
  strictEqual(state.rollbacks, 1);
});
