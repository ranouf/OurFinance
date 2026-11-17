import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { readPreparedRestoreJob, stagePreparedRestoreReceipt, PreparedRestoreError } from '../src/restore-prepared';
import { prepareRestore } from '../src/restore-prepared';
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
      ownerId: { stringValue: 'alice' }, status: { stringValue: 'staging' }, manifestSha256: { stringValue: 'a'.repeat(64) },
      newPublicIds: { arrayValue: { values: [{ stringValue: publicId }] } },
      receiptSha256: { arrayValue: { values: [{ stringValue: expectedDigest }] } },
      receiptFormats: { arrayValue: { values: [{ stringValue: 'png' }] } },
      stagedIndices: { arrayValue: { values: staged.map(stringValue => ({ stringValue })) } },
    } });
    throw new Error('Requête inattendue');
  };
  return { env, transport: transport as typeof fetch, get uploads() { return uploads; }, get patches() { return patches; },
    get requests() { return requests; }, get staged() { return staged; }, failPatch() { failNextPatch = true; } };
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
  deepStrictEqual(await prepareRestore('alice', 'g', restoreId, decoded, state.env, transport as typeof fetch),
    { restoreId, expectedReceipts: 30 });
  strictEqual(savedHashes, 30);
});
