import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { readCurrentRestore, RestoreCurrentError } from '../src/restore-current';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';

async function fixture(options: { groupStatus?: string; memberStatus?: string; role?: string; jobStatus?: string;
  restoreOwnerId?: string; jobOwnerId?: string; lastRestoreId?: string; } = {}) {
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
      return Response.json({ transaction: 'txn' });
    }
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.includes('/groups/group-a/members/alice?')) return Response.json({ fields: {
      role: { stringValue: options.role ?? 'owner' }, status: { stringValue: options.memberStatus ?? 'active' },
    } });
    if (url.includes('/groups/group-a/restoreJobs/')) {
      jobReads++;
      return Response.json({ fields: { ownerId: { stringValue: options.jobOwnerId ?? 'alice' },
        status: { stringValue: options.jobStatus ?? 'staging' },
        manifestSha256: { stringValue: 'a'.repeat(64) }, newPublicIds: { arrayValue: { values: [{ stringValue: 'private-asset' }] } },
      } });
    }
    if (url.includes('/groups/group-a?')) return Response.json({ fields: {
      ownerId: { stringValue: 'alice' }, status: { stringValue: options.groupStatus ?? 'restoring' },
      restoreId: { stringValue: restoreId }, restoreOwnerId: { stringValue: options.restoreOwnerId ?? 'alice' },
      ...(options.lastRestoreId ? { lastRestoreId: { stringValue: options.lastRestoreId } } : {}),
    } });
    throw new Error(`Unexpected request: ${url}`);
  };
  return { env, transport: transport as typeof fetch, get rollbacks() { return rollbacks; }, get jobReads() { return jobReads; } };
}

test('owner can recover only a staging restore ID, without archive or media details', async () => {
  const state = await fixture();
  const result = await readCurrentRestore('alice', 'group-a', state.env, state.transport);
  deepStrictEqual(result, { status: 'staging', restoreId });
  strictEqual(JSON.stringify(result).includes('private-asset'), false);
  strictEqual(state.rollbacks, 1);
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
