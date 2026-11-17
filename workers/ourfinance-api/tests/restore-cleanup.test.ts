import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { retryRestoreCleanup, RestoreCleanupError } from '../src/restore-cleanup';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';

async function fixture(role: 'owner' | 'member' = 'owner', count = 1) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: 'synthetic', CLOUDINARY_API_SECRET: 'synthetic',
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  let destroys = 0;
  let patches = 0;
  let requests = 0;
  let oldPublicIds = Array.from({ length: count }, (_, index) => `ourfinance-test/g/e/old_${index}`);
  let status = 'cleanup_pending';
  let failNextPatch = false;
  let missingUpdateTime = false;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    requests++;
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-service-token' });
    if (url.endsWith('/image/destroy')) { destroys++; return Response.json({ result: 'ok' }); }
    if (url.includes(`/groups/g/restoreJobs/${restoreId}?`) && init?.method === 'PATCH') {
      patches++;
      strictEqual(new URL(url).searchParams.get('currentDocument.updateTime'), '2026-11-17T00:00:00Z');
      if (failNextPatch) { failNextPatch = false; return Response.json({}, { status: 503 }); }
      const fields = (JSON.parse(String(init.body)) as { fields: { oldPublicIds: { arrayValue: { values: { stringValue: string }[] } }; status?: { stringValue: string } } }).fields;
      oldPublicIds = fields.oldPublicIds.arrayValue.values.map(row => row.stringValue);
      if (fields.status) status = fields.status.stringValue;
      return Response.json({});
    }
    if (url.endsWith('/groups/g')) return Response.json({ fields: { status: { stringValue: 'active' }, ownerId: { stringValue: 'alice' } } });
    if (url.endsWith('/groups/g/members/alice')) return Response.json({ fields: { status: { stringValue: 'active' }, role: { stringValue: role } } });
    if (url.endsWith(`/groups/g/restoreJobs/${restoreId}`)) return Response.json({ ...(missingUpdateTime ? {} : { updateTime: '2026-11-17T00:00:00Z' }), fields: {
      ownerId: { stringValue: 'alice' }, status: { stringValue: status },
      oldPublicIds: { arrayValue: { values: oldPublicIds.map(stringValue => ({ stringValue })) } },
      newPublicIds: { arrayValue: { values: [{ stringValue: `ourfinance-test/g/e/restore_${restoreId}/a` }] } },
    } });
    throw new Error('Requête inattendue');
  };
  return { env, transport: transport as typeof fetch, get destroys() { return destroys; }, get patches() { return patches; }, get requests() { return requests; }, get remaining() { return oldPublicIds.length; }, failPatch() { failNextPatch = true; }, omitUpdateTime() { missingUpdateTime = true; } };
}

test('owner removes only old private assets and marks the cleanup job complete', async () => {
  const state = await fixture();
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 1, pending: false });
  strictEqual(state.destroys, 1);
  strictEqual(state.patches, 1);
});

test('cleanup resumes in bounded batches and never loses its journal', async () => {
  const state = await fixture('owner', 45);
  const before = state.requests;
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 20, pending: true });
  strictEqual(state.requests - before < 50, true);
  strictEqual(state.remaining, 25);
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 20, pending: true });
  strictEqual(state.remaining, 5);
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 5, pending: false });
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 0, pending: false });
  strictEqual(state.destroys, 45);
  strictEqual(state.patches, 3);
});

test('lost progress write retains journal and retries idempotent media deletion', async () => {
  const state = await fixture('owner', 21);
  state.failPatch();
  await rejects(retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport),
    (error: unknown) => error instanceof RestoreCleanupError && error.code === 'cleanup_state_unavailable');
  strictEqual(state.remaining, 21);
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 20, pending: true });
  strictEqual(state.remaining, 1);
  strictEqual(state.destroys, 40);
});

test('cleanup refuses a job without a Firestore write precondition', async () => {
  const state = await fixture();
  state.omitUpdateTime();
  await rejects(retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport),
    (error: unknown) => error instanceof RestoreCleanupError && error.code === 'invalid_cleanup_journal');
  strictEqual(state.destroys, 0);
  strictEqual(state.patches, 0);
});

test('ordinary member cannot delete restore assets', async () => {
  const state = await fixture('member');
  await rejects(retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport),
    (error: unknown) => error instanceof RestoreCleanupError && error.status === 403);
  strictEqual(state.destroys, 0);
});
