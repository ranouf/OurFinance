import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { retryRestoreCleanup, RestoreCleanupError } from '../src/restore-cleanup';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';

async function fixture(role: 'owner' | 'member' = 'owner') {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: 'synthetic', CLOUDINARY_API_SECRET: 'synthetic',
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  let destroys = 0;
  let patches = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-service-token' });
    if (url.endsWith('/image/destroy')) { destroys++; return Response.json({ result: 'ok' }); }
    if (url.includes(`/groups/g/restoreJobs/${restoreId}?`) && init?.method === 'PATCH') { patches++; return Response.json({}); }
    if (url.endsWith('/groups/g')) return Response.json({ fields: { status: { stringValue: 'active' }, ownerId: { stringValue: 'alice' } } });
    if (url.endsWith('/groups/g/members/alice')) return Response.json({ fields: { status: { stringValue: 'active' }, role: { stringValue: role } } });
    if (url.endsWith(`/groups/g/restoreJobs/${restoreId}`)) return Response.json({ fields: {
      ownerId: { stringValue: 'alice' }, status: { stringValue: 'cleanup_pending' },
      oldPublicIds: { arrayValue: { values: [{ stringValue: 'ourfinance-test/g/e/old' }] } },
      newPublicIds: { arrayValue: { values: [{ stringValue: `ourfinance-test/g/e/restore_${restoreId}/a` }] } },
    } });
    throw new Error('Requête inattendue');
  };
  return { env, transport: transport as typeof fetch, get destroys() { return destroys; }, get patches() { return patches; } };
}

test('owner removes only old private assets and marks the cleanup job complete', async () => {
  const state = await fixture();
  strictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), 1);
  strictEqual(state.destroys, 1);
  strictEqual(state.patches, 1);
});

test('ordinary member cannot delete restore assets', async () => {
  const state = await fixture('member');
  await rejects(retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport),
    (error: unknown) => error instanceof RestoreCleanupError && error.status === 403);
  strictEqual(state.destroys, 0);
});
