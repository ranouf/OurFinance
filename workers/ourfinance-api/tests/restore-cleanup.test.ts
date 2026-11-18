import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { retryRestoreCleanup, RestoreCleanupError } from '../src/restore-cleanup';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';

async function fixture(role: 'owner' | 'member' = 'owner', count = 1, pendingMarker = false, overrides: {
  groupStatus?: string; groupOwner?: string; memberStatus?: string; jobOwner?: string; jobStatus?: string;
  oldPublicIds?: string[]; newPublicIds?: string[]; missingGroup?: boolean; missingMember?: boolean; missingJob?: boolean;
  missingOldIds?: boolean; missingNewIds?: boolean;
} = {}) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: 'synthetic', CLOUDINARY_API_SECRET: 'synthetic',
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  let destroys = 0;
  let patches = 0;
  let markerPatches = 0;
  let requests = 0;
  let oldPublicIds = overrides.oldPublicIds ?? Array.from({ length: count }, (_, index) => `ourfinance-test/g/e/old_${index}`);
  let status = overrides.jobStatus ?? 'cleanup_pending';
  let failNextPatch = false;
  let failMarkerPatch = false;
  let missingUpdateTime = false;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    requests++;
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-service-token' });
    if (url.endsWith('/image/destroy')) { destroys++; return Response.json({ result: 'ok' }); }
    if (url.endsWith('/documents:commit') && init?.method === 'POST') {
      markerPatches++;
      const write = JSON.parse(String(init.body)).writes[0];
      strictEqual(write.update.name, 'projects/ourfinance-test/databases/(default)/documents/groups/g');
      strictEqual(write.currentDocument.updateTime, '2026-11-17T00:00:00Z');
      deepStrictEqual(write.updateMask.fieldPaths, ['pendingCleanupRestoreId']);
      deepStrictEqual(write.update.fields, {});
      if (failMarkerPatch) { failMarkerPatch = false; return Response.json({}, { status: 400 }); }
      pendingMarker = false;
      return Response.json({});
    }
    if (url.includes(`/groups/g/restoreJobs/${restoreId}?`) && init?.method === 'PATCH') {
      patches++;
      strictEqual(new URL(url).searchParams.get('currentDocument.updateTime'), '2026-11-17T00:00:00Z');
      if (failNextPatch) { failNextPatch = false; return Response.json({}, { status: 503 }); }
      const fields = (JSON.parse(String(init.body)) as { fields: { oldPublicIds: { arrayValue: { values: { stringValue: string }[] } }; status?: { stringValue: string } } }).fields;
      oldPublicIds = fields.oldPublicIds.arrayValue.values.map(row => row.stringValue);
      if (fields.status) status = fields.status.stringValue;
      return Response.json({});
    }
    if (url.endsWith('/groups/g')) return overrides.missingGroup ? Response.json({}, { status: 404 }) : Response.json({ updateTime: '2026-11-17T00:00:00Z', fields: { status: { stringValue: overrides.groupStatus ?? 'active' }, ownerId: { stringValue: overrides.groupOwner ?? 'alice' },
      ...(pendingMarker ? { pendingCleanupRestoreId: { stringValue: restoreId } } : {}) } });
    if (url.endsWith('/groups/g/members/alice')) return overrides.missingMember ? Response.json({}, { status: 404 }) : Response.json({ fields: { status: { stringValue: overrides.memberStatus ?? 'active' }, role: { stringValue: role } } });
    if (url.endsWith(`/groups/g/restoreJobs/${restoreId}`)) return overrides.missingJob ? Response.json({}, { status: 404 }) : Response.json({ ...(missingUpdateTime ? {} : { updateTime: '2026-11-17T00:00:00Z' }), fields: {
      ownerId: { stringValue: overrides.jobOwner ?? 'alice' }, status: { stringValue: status },
      ...(overrides.missingOldIds ? {} : { oldPublicIds: { arrayValue: { values: oldPublicIds.map(stringValue => ({ stringValue })) } } }),
      ...(overrides.missingNewIds ? {} : { newPublicIds: { arrayValue: { values: (overrides.newPublicIds ?? [`ourfinance-test/g/e/restore_${restoreId}/a`]).map(stringValue => ({ stringValue })) } } }),
    } });
    throw new Error('Requête inattendue');
  };
  return { env, transport: transport as typeof fetch, get destroys() { return destroys; }, get patches() { return patches; },
    get markerPatches() { return markerPatches; }, get pendingMarker() { return pendingMarker; }, get requests() { return requests; },
    get remaining() { return oldPublicIds.length; }, failPatch() { failNextPatch = true; },
    failMarker() { failMarkerPatch = true; }, omitUpdateTime() { missingUpdateTime = true; } };
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

test('aborted cleanup marker survives a bounded batch and is cleared after completion', async () => {
  const state = await fixture('owner', 25, true);
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 20, pending: true });
  strictEqual(state.pendingMarker, true);
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 5, pending: false });
  strictEqual(state.pendingMarker, false);
  strictEqual(state.markerPatches, 1);
});

test('completed cleanup retries clearing a marker after a precondition conflict', async () => {
  const state = await fixture('owner', 1, true);
  state.failMarker();
  await rejects(retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport),
    (error: unknown) => error instanceof RestoreCleanupError && error.status === 409);
  strictEqual(state.pendingMarker, true);
  deepStrictEqual(await retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport), { removed: 0, pending: false });
  strictEqual(state.pendingMarker, false);
  strictEqual(state.markerPatches, 2);
});

test('cleanup rejects absent or changed owner and journal before deleting media', async () => {
  for (const [overrides, status, code] of [
    [{ missingGroup: true }, 409, 'cleanup_unavailable'],
    [{ missingMember: true }, 409, 'cleanup_unavailable'],
    [{ missingJob: true }, 409, 'cleanup_unavailable'],
    [{ groupStatus: 'archived' }, 403, 'owner_required'],
    [{ groupOwner: 'other' }, 403, 'owner_required'],
    [{ memberStatus: 'revoked' }, 403, 'owner_required'],
    [{ jobOwner: 'other' }, 403, 'owner_required'],
    [{ jobStatus: 'staging' }, 409, 'cleanup_not_pending'],
    [{ oldPublicIds: ['ourfinance-test/other/e/a'] }, 503, 'invalid_cleanup_journal'],
    [{ oldPublicIds: ['ourfinance-test/g/e/restore_123e4567-e89b-42d3-a456-426614174000/a'] }, 503, 'invalid_cleanup_journal'],
    [{ missingOldIds: true }, 503, 'invalid_cleanup_journal'],
    [{ missingNewIds: true }, 503, 'invalid_cleanup_journal'],
    [{ oldPublicIds: Array.from({ length: 1001 }, (_, i) => `ourfinance-test/g/e/old_${i}`) }, 503, 'invalid_cleanup_journal'],
    [{ newPublicIds: ['ourfinance-test/other/e/a'] }, 503, 'invalid_cleanup_journal'],
  ] as const) {
    const state = await fixture('owner', 1, false, overrides);
    await rejects(retryRestoreCleanup('alice', 'g', restoreId, state.env, state.transport),
      (error: unknown) => error instanceof RestoreCleanupError && error.status === status && error.code === code);
    strictEqual(state.destroys, 0);
  }
});
