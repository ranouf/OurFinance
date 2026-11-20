import { withBatchGet } from './batch-get-mock';
import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { commitPreparedRestore, prepareRestore, readPreparedRestoreJob, stagePreparedRestoreReceipt, PreparedRestoreError } from '../src/restore-prepared';
import { sha256Hex } from '../../../src/app/features/import-export/backup-package';
import type { BackupManifestV2 } from '../../../src/app/features/import-export/backup-package-v2';
import { encodeBackupZipV2 } from '../../../src/app/features/import-export/backup-zip';
import { decodeBackupZipV2 } from '../../../src/app/features/import-export/backup-zip-read';
import { serializeGroupExportV2, type GroupExportV2 } from '../../../src/app/features/import-export/export-v2';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);
const digest = createHash('sha256').update(png).digest('hex');
const publicId = `ourfinance-test/g/e/restore_${restoreId}/a`;

async function fixture(role: 'owner' | 'member' = 'owner', expectedDigest = digest) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }), CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: 'synthetic', CLOUDINARY_API_SECRET: 'synthetic' };
  let uploads = 0;
  let patches = 0;
  let requests = 0;
  let staged: string[] = [];
  let jobIds = [publicId];
  let jobDigests = [expectedDigest];
  let jobFormats = ['png'];
  let jobManifest = 'a'.repeat(64);
  let failNextPatch = false;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    requests++;
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-service-token' });
    if (url.endsWith('/image/upload')) {
      uploads++;
      const form = init?.body as FormData;
      strictEqual(form.get('type'), 'authenticated');
      strictEqual(form.get('overwrite'), 'true');
      strictEqual(form.get('public_id'), publicId);
      return Response.json({ public_id: publicId, type: 'authenticated', resource_type: 'image', format: 'png' });
    }
    if (url.includes(`/groups/g/restoreJobs/${restoreId}?`) && init?.method === 'PATCH') {
      patches++;
      strictEqual(new URL(url).searchParams.get('currentDocument.updateTime'), '2026-11-17T00:00:00Z');
      if (failNextPatch) { failNextPatch = false; return Response.json({}, { status: 503 }); }
      staged = (JSON.parse(String(init.body)) as { fields: { stagedIndices: { arrayValue: { values: { stringValue: string }[] } } } })
        .fields.stagedIndices.arrayValue.values.map(item => item.stringValue);
      return Response.json({});
    }
    if (url.endsWith('/groups/g')) return Response.json({ fields: { ownerId: { stringValue: 'alice' }, status: { stringValue: 'restoring' },
      restoreId: { stringValue: restoreId }, restoreOwnerId: { stringValue: 'alice' } } });
    if (url.endsWith('/groups/g/members/alice')) return Response.json({ fields: { role: { stringValue: role }, status: { stringValue: 'active' } } });
    if (url.endsWith(`/groups/g/restoreJobs/${restoreId}`)) return Response.json({ updateTime: '2026-11-17T00:00:00Z', fields: {
      ownerId: { stringValue: 'alice' }, status: { stringValue: 'staging' }, manifestSha256: { stringValue: jobManifest },
      newPublicIds: { arrayValue: { values: jobIds.map(stringValue => ({ stringValue })) } },
      receiptSha256: { arrayValue: { values: jobDigests.map(stringValue => ({ stringValue })) } },
      receiptFormats: { arrayValue: { values: jobFormats.map(stringValue => ({ stringValue })) } },
      stagedIndices: { arrayValue: { values: staged.map(stringValue => ({ stringValue })) } },
    } });
    throw new Error('Requête inattendue');
  };
  return { env, transport: withBatchGet(transport), get uploads() { return uploads; }, get patches() { return patches; },
    get requests() { return requests; }, get staged() { return staged; }, failPatch() { failNextPatch = true; },
    setJob(ids: string[], digests: string[], formats: string[], manifest: string, indices: string[]) {
      jobIds = ids; jobDigests = digests; jobFormats = formats; jobManifest = manifest; staged = indices;
    } };
}

test('prepared restore stages one exact private receipt and retries idempotently', async () => {
  const state = await fixture();
  deepStrictEqual(await stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, png, 'png', state.env, state.transport), { staged: true });
  strictEqual(state.requests < 50, true);
  deepStrictEqual(state.staged, ['0']);
  deepStrictEqual(await stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, png, 'png', state.env, state.transport), { staged: false });
  strictEqual(state.uploads, 1);
  strictEqual(state.patches, 1);
});

test('ordinary member and wrong digest cannot upload a prepared receipt', async () => {
  const member = await fixture('member');
  await rejects(stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, png, 'png', member.env, member.transport),
    (error: unknown) => error instanceof PreparedRestoreError && error.status === 403);
  strictEqual(member.uploads, 0);
  const wrong = await fixture('owner', 'b'.repeat(64));
  await rejects(stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, png, 'png', wrong.env, wrong.transport),
    (error: unknown) => error instanceof PreparedRestoreError && error.status === 400);
  strictEqual(wrong.uploads, 0);
  await rejects(stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, png, 'jpg', wrong.env, wrong.transport),
    (error: unknown) => error instanceof PreparedRestoreError && error.status === 400);
  const job = await readPreparedRestoreJob('alice', 'g', restoreId, wrong.env, wrong.transport);
  strictEqual(job.publicIds.length, 1);
});

test('lost stage progress is recoverable by uploading the same verified bytes again', async () => {
  const state = await fixture();
  state.failPatch();
  await rejects(stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, png, 'png', state.env, state.transport),
    (error: unknown) => error instanceof PreparedRestoreError && error.code === 'stage_unavailable');
  deepStrictEqual(state.staged, []);
  deepStrictEqual(await stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, png, 'png', state.env, state.transport), { staged: true });
  strictEqual(state.uploads, 2);
});

test('prepared receipt job rejects invalid identifiers and inconsistent staged metadata', async () => {
  const state = await fixture();
  await rejects(readPreparedRestoreJob('bad/uid', 'g', restoreId, state.env, state.transport), PreparedRestoreError);
  await rejects(readPreparedRestoreJob('alice', 'g', 'wrong', state.env, state.transport), PreparedRestoreError);
  strictEqual(state.requests, 0);
  const invalidJobs: readonly [string[], string[], string[], string, string[]][] = [
    [[publicId, publicId], [digest, digest], ['png', 'png'], 'a'.repeat(64), []],
    [[publicId], ['bad'], ['png'], 'a'.repeat(64), []],
    [[publicId], [digest], ['gif'], 'a'.repeat(64), []],
    [[publicId], [digest], ['png'], 'bad', []],
    [[publicId], [digest], ['png'], 'a'.repeat(64), ['1']],
    [[publicId], [digest], ['png'], 'a'.repeat(64), ['0', '0']],
    [['ourfinance-test/other/e/a'], [digest], ['png'], 'a'.repeat(64), []],
  ];
  for (const [ids, digests, formats, manifest, indices] of invalidJobs) {
    state.setJob(ids, digests, formats, manifest, indices);
    await rejects(readPreparedRestoreJob('alice', 'g', restoreId, state.env, state.transport),
      (error: unknown) => error instanceof PreparedRestoreError && error.code === 'invalid_restore_job');
  }
});

test('prepared job fails closed for missing owner membership and changed restore lock', async () => {
  const state = await fixture();
  const scenarios: readonly [string, Response, number, string][] = [
    ['/members/alice', Response.json({}, { status: 404 }), 403, 'owner_required'],
    ['/groups/g/restoreJobs/', Response.json({}, { status: 404 }), 409, 'restore_unavailable'],
    ['/groups/g', Response.json({ fields: { ownerId: { stringValue: 'other' } } }), 403, 'owner_required'],
    ['/groups/g', Response.json({ fields: { ownerId: { stringValue: 'alice' }, status: { stringValue: 'active' } } }), 409, 'restore_state_changed'],
    ['/members/alice', Response.json({ fields: { role: { stringValue: 'member' }, status: { stringValue: 'active' } } }), 403, 'owner_required'],
    ['/groups/g/restoreJobs/', Response.json({ fields: { ownerId: { stringValue: 'alice' }, status: { stringValue: 'completed' } } }), 409, 'restore_state_changed'],
  ];
  for (const [path, response, status, code] of scenarios) {
    const transport = (async (resource: string | URL | Request, init?: RequestInit) => {
      const url = String(resource);
      if (url.includes('oauth2.googleapis.com')) return state.transport(resource, init);
      if (path === '/groups/g' ? new URL(url).pathname.endsWith(path) : url.includes(path)) return response.clone();
      return state.transport(resource, init);
    }) as typeof fetch;
    await rejects(readPreparedRestoreJob('alice', 'g', restoreId, state.env, transport),
      (error: unknown) => error instanceof PreparedRestoreError && error.status === status && error.code === code);
  }
});

test('prepared job refuses incomplete and out-of-range stage metadata', async () => {
  const state = await fixture();
  for (const [ids, digests, formats, manifest, indices] of [
    [[publicId], [], ['png'], 'a'.repeat(64), []],
    [[publicId], [digest], [], 'a'.repeat(64), []],
    [[publicId], [digest], ['png'], 'a'.repeat(64), ['-1']],
    [[publicId], [digest], ['png'], 'a'.repeat(64), ['01']],
    [[publicId], [digest], ['png'], 'a'.repeat(64), ['100']],
    [[publicId], [digest], ['png'], 'a'.repeat(64), ['not-an-index']],
    [[publicId], [digest], ['jpg'], 'a'.repeat(64), ['0', '0']],
  ] as const) {
    state.setJob([...ids], [...digests], [...formats], manifest, [...indices]);
    await rejects(readPreparedRestoreJob('alice', 'g', restoreId, state.env, state.transport),
      (error: unknown) => error instanceof PreparedRestoreError && error.code === 'invalid_restore_job');
  }
});

test('prepared job refuses missing Firestore fields and malformed list values', async () => {
  const state = await fixture();
  const base = { updateTime: '2026-11-17T00:00:00Z', fields: {
    ownerId: { stringValue: 'alice' }, status: { stringValue: 'staging' }, manifestSha256: { stringValue: 'a'.repeat(64) },
    newPublicIds: { arrayValue: { values: [{ stringValue: publicId }] } },
    receiptSha256: { arrayValue: { values: [{ stringValue: digest }] } },
    receiptFormats: { arrayValue: { values: [{ stringValue: 'png' }] } },
    stagedIndices: { arrayValue: { values: [] as { stringValue?: string }[] } },
  } };
  const variants = [
    { ...base, updateTime: undefined },
    { ...base, fields: { ...base.fields, newPublicIds: { arrayValue: { values: [{ stringValue: 'other' }] } } } },
    { ...base, fields: { ...base.fields, receiptSha256: { arrayValue: { values: [{ stringValue: undefined }] } } } },
    { ...base, fields: { ...base.fields, receiptFormats: { arrayValue: { values: [{ stringValue: 'gif' }] } } } },
    { ...base, fields: { ...base.fields, stagedIndices: { arrayValue: { values: [{ stringValue: undefined }] } } } },
    { ...base, fields: { ...base.fields, manifestSha256: { stringValue: 'bad' } } },
  ];
  for (const document of variants) {
    const transport = (async (resource: string | URL | Request, init?: RequestInit) =>
      String(resource).endsWith(`/groups/g/restoreJobs/${restoreId}`) ? Response.json(document) : state.transport(resource, init)) as typeof fetch;
    await rejects(readPreparedRestoreJob('alice', 'g', restoreId, state.env, transport),
      (error: unknown) => error instanceof PreparedRestoreError && error.code === 'invalid_restore_job');
  }
});

test('staging rejects invalid index, bytes and format before media upload', async () => {
  const state = await fixture();
  for (const index of [-1, 1.5, 1]) {
    await rejects(stagePreparedRestoreReceipt('alice', 'g', restoreId, index, png, 'png', state.env, state.transport), PreparedRestoreError);
  }
  await rejects(stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, new Uint8Array(2_000_001), 'png', state.env, state.transport), PreparedRestoreError);
  await rejects(stagePreparedRestoreReceipt('alice', 'g', restoreId, 0, png, 'jpg', state.env, state.transport), PreparedRestoreError);
  strictEqual(state.uploads, 0);
});

test('30 synthetic private receipts roundtrip through V2 ZIP and prepared lock', async () => {
  const at = '2026-11-17T00:00:00.000Z';
  const expenses = Array.from({ length: 30 }, (_, index) => ({ id: `e${index}`, date: '2026-11-16', description: 'Fictif', currency: 'CAD',
    amountMinor: 1, categoryId: 'food', categoryLabel: 'Repas', categoryIcon: 'meal', categoryColor: '#ffffff',
    payments: [{ userId: 'alice', amountMinor: 1 }], allocations: [{ userId: 'alice', amountMinor: 1 }],
    splitSnapshotJson: '{}', deleted: false }));
  const receiptRows = expenses.map((item, index) => ({ expenseId: item.id, attachmentId: `a${index}`, format: 'png' as const,
    status: 'active' as const, mediaIncluded: false as const }));
  const group: GroupExportV2 = { format: 'OurFinanceGroupExport', version: 2, snapshotMode: 'server_transaction', exportedAt: at,
    group: { id: 'g', name: 'Fictif', currency: 'CAD' }, members: [{ userId: 'alice', role: 'owner', status: 'active' }],
    expenses, settlements: [], importedRecords: [], categories: [], receipts: receiptRows,
    expenseAuthors: expenses.map(row => ({ expenseId: row.id, userId: 'alice' })),
    receiptOwners: receiptRows.map(row => ({ expenseId: row.expenseId, attachmentId: row.attachmentId, ownerId: 'alice' })),
    receiptAssets: receiptRows.map(row => ({ expenseId: row.expenseId, attachmentId: row.attachmentId,
      publicId: `ourfinance-test/g/${row.expenseId}/${row.attachmentId}` })),
    comments: [], activity: [], importBatches: [], preferences: [{ userId: 'alice', modeJson: null, memberIds: [], updatedAt: null }],
  };
  const groupJson = serializeGroupExportV2(group);
  const groupBytes = new TextEncoder().encode(groupJson);
  const manifest: BackupManifestV2 = {
    format: 'OurFinanceBackupManifest', version: 2, scope: 'group-v2-partial', groupId: 'g', exportedAt: at,
    groupJson: { filename: 'group.json', sha256: await sha256Hex(groupBytes), byteLength: groupBytes.byteLength },
    receipts: receiptRows.map(row => ({ expenseId: row.expenseId, attachmentId: row.attachmentId,
      filename: `g/${row.expenseId}/${row.attachmentId}.png`, sha256: digest, byteLength: png.byteLength, contentType: 'image/png' })),
  };
  const archive = { manifest, groupJson, receipts: manifest.receipts.map(row => ({ ...row, bytes: png })) };
  const zip = await encodeBackupZipV2(archive);
  const decoded = await decodeBackupZipV2(zip);
  strictEqual(decoded.receipts.length, 30);
  const state = await fixture();
  let savedHashes = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'synthetic-txn' });
    if (url.includes('/groups/g/members/alice?transaction=')) return Response.json({ fields: { role: { stringValue: 'owner' }, status: { stringValue: 'active' } } });
    if (url.includes('/groups/g?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } } });
    if (url.endsWith(':commit')) {
      const body = JSON.parse(String(init?.body)) as { writes: { update: { fields: { receiptSha256: { arrayValue: { values: unknown[] } } } } }[] };
      savedHashes = body.writes[1].update.fields.receiptSha256.arrayValue.values.length;
      return Response.json({});
    }
    return state.transport(resource, init);
  };
  deepStrictEqual(await prepareRestore('alice', 'g', restoreId, decoded, state.env, withBatchGet(transport)),
    { restoreId, expectedReceipts: 30 });
  strictEqual(savedHashes, 30);
  await rejects(commitPreparedRestore('alice', 'g', restoreId, decoded, state.env, withBatchGet(transport)),
    (error: unknown) => error instanceof PreparedRestoreError && error.code === 'receipts_not_staged');
  const fingerprint = await sha256Hex(new TextEncoder().encode(JSON.stringify(decoded.manifest)));
  const ids = decoded.manifest.receipts.map(row => `ourfinance-test/g/${row.expenseId}/restore_${restoreId}/${row.attachmentId}`);
  state.setJob(ids, decoded.manifest.receipts.map(row => row.sha256), ids.map(() => 'png'), fingerprint,
    ids.map((_, index) => String(index)));
  const lostLockTransport = async (resource: string | URL | Request, init?: RequestInit) =>
    String(resource).endsWith(':beginTransaction') ? Response.json({}, { status: 409 }) : state.transport(resource, init);
  deepStrictEqual(await prepareRestore('alice', 'g', restoreId, decoded, state.env, lostLockTransport as typeof fetch),
    { restoreId, expectedReceipts: 30 });
  let committed = 0;
  const result = await commitPreparedRestore('alice', 'g', restoreId, decoded, state.env, withBatchGet(transport), {
    inventory: async () => ({ groupDocuments: ['groups/g'], userDocuments: [], receiptPublicIds: [] }),
    commit: async (_uid, _groupId, _restoreId, _backup, _live, staged) => { committed = staged.length; return []; },
    outcome: async () => 'locked',
  });
  strictEqual(committed, 30);
  deepStrictEqual(result, { restoreId, cleanupPending: true });
  const inventory = async () => ({ groupDocuments: ['groups/g'], userDocuments: [], receiptPublicIds: [] });
  const failedCommit = async (): Promise<readonly string[]> => { throw new Error('lost commit response'); };
  deepStrictEqual(await commitPreparedRestore('alice', 'g', restoreId, decoded, state.env, withBatchGet(transport), {
    inventory, commit: failedCommit, outcome: async () => 'committed',
  }), { restoreId, cleanupPending: true });
  await rejects(commitPreparedRestore('alice', 'g', restoreId, decoded, state.env, withBatchGet(transport), {
    inventory, commit: failedCommit, outcome: async () => 'locked',
  }), (error: unknown) => error instanceof PreparedRestoreError && error.code === 'restore_not_committed');
  await rejects(commitPreparedRestore('alice', 'g', restoreId, decoded, state.env, withBatchGet(transport), {
    inventory, commit: failedCommit, outcome: async () => { throw new Error('outcome unavailable'); },
  }), (error: unknown) => error instanceof PreparedRestoreError && error.code === 'recovery_required');
  const missingJob = (async (resource: string | URL | Request, init?: RequestInit) =>
    String(resource).endsWith(`/groups/g/restoreJobs/${restoreId}`) ? Response.json({}, { status: 404 }) : state.transport(resource, init)) as typeof fetch;
  deepStrictEqual(await commitPreparedRestore('alice', 'g', restoreId, decoded, state.env, missingJob, {
    inventory, commit: failedCommit, outcome: async () => 'committed',
  }), { restoreId, cleanupPending: true });
  await rejects(commitPreparedRestore('alice', 'g', restoreId, decoded, state.env, missingJob, {
    inventory, commit: failedCommit, outcome: async () => 'locked',
  }), (error: unknown) => error instanceof PreparedRestoreError && error.status === 409);
  for (const mismatch of [
    { manifest: 'b'.repeat(64), ids, digests: decoded.manifest.receipts.map(row => row.sha256), formats: ids.map(() => 'png'), stages: ids.map((_, index) => String(index)) },
    { manifest: fingerprint, ids: ids.slice(1), digests: decoded.manifest.receipts.map(row => row.sha256).slice(1), formats: ids.slice(1).map(() => 'png'), stages: ids.slice(1).map((_, index) => String(index)) },
    { manifest: fingerprint, ids, digests: ids.map(() => 'b'.repeat(64)), formats: ids.map(() => 'png'), stages: ids.map((_, index) => String(index)) },
    { manifest: fingerprint, ids, digests: decoded.manifest.receipts.map(row => row.sha256), formats: ids.map(() => 'jpg'), stages: ids.map((_, index) => String(index)) },
    { manifest: fingerprint, ids, digests: decoded.manifest.receipts.map(row => row.sha256), formats: ids.map(() => 'png'), stages: ids.slice(1).map((_, index) => String(index)) },
    { manifest: fingerprint, ids, digests: decoded.manifest.receipts.map(row => row.sha256), formats: ids.map(() => 'png'), stages: ids.map((_, index) => String(ids.length - index - 1)) },
  ]) {
    state.setJob(mismatch.ids, mismatch.digests, mismatch.formats, mismatch.manifest, mismatch.stages);
    await rejects(commitPreparedRestore('alice', 'g', restoreId, decoded, state.env, state.transport, {
      inventory, commit: failedCommit, outcome: async () => 'locked',
    }), (error: unknown) => error instanceof PreparedRestoreError && error.code === 'receipts_not_staged');
  }
});
