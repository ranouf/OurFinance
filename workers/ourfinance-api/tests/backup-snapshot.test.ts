import { withBatchGet } from './batch-get-mock';
import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { collectBackupSnapshotV2, BackupSnapshotError } from '../src/backup-snapshot';

async function fixture(role: 'owner' | 'member' = 'owner', expenseCount = 0, groupStatus: 'active' | 'archived' = 'active',
  failure?: 'begin' | 'transaction' | 'bad-name' | 'bad-field' | 'unsafe-integer' | 'unsupported-field' | 'list' | 'rollback') {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  const root = 'projects/ourfinance-test/databases/(default)/documents';
  let rollbacks = 0;
  let transactionReads = 0;
  const document = (path: string, fields: Record<string, unknown>) => ({ name: `${root}/${path}`, fields });
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(resource));
    if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'synthetic-service-token' });
    if (url.pathname.endsWith(':beginTransaction')) {
      strictEqual(JSON.parse(String(init?.body)).options.readOnly !== undefined, true);
      return Response.json(failure === 'transaction' ? {} : { transaction: 'snapshot-txn' }, { status: failure === 'begin' ? 503 : 200 });
    }
    if (url.pathname.endsWith(':rollback')) { rollbacks++; if (failure === 'rollback') throw new Error('network'); return Response.json({}); }
    const query = url.pathname.endsWith(':runQuery');
    if ((query ? JSON.parse(String(init?.body)).transaction : url.searchParams.get('transaction')) !== 'snapshot-txn') throw new Error('Lecture hors transaction');
    transactionReads++;
    if (query) {
      const kind = JSON.parse(String(init?.body)).structuredQuery.from[0].collectionId;
      if (expenseCount > 0 && kind === 'attachments') return Response.json([{ document: document('groups/g/expenses/e0/attachments/a', {
        format: { stringValue: 'png' }, status: { stringValue: 'active' }, ownerId: { stringValue: 'alice' },
        publicId: { stringValue: 'ourfinance-test/g/e0/a' },
      }) }]);
      if (expenseCount > 0 && kind === 'comments') return Response.json([{ document: document('groups/g/expenses/e0/comments/c', {
        authorId: { stringValue: 'alice' }, text: { stringValue: 'Fictif' }, createdAt: { timestampValue: '2026-11-16T18:00:00.000Z' },
      }) }]);
      return Response.json([]);
    }
    const path = url.pathname.slice(`/v1/${root}/`.length);
    if (path === 'groups/g') return Response.json(failure === 'bad-name' ? document('groups/other', {}) :
      document(path, { status: { stringValue: groupStatus }, name: failure === 'bad-field' ? false : { stringValue: 'Fictif' },
        currencyCode: { stringValue: 'CAD' }, ...(failure === 'unsafe-integer' ? { value: { integerValue: '9007199254740992' } } : {}),
        ...(failure === 'unsupported-field' ? { value: { bytesValue: 'invalid' } } : {}) }));
    if (path === 'groups/g/members/alice') return Response.json(document(path, { status: { stringValue: 'active' }, role: { stringValue: role } }));
    if (path === 'groups/g/members') return Response.json({ documents: failure === 'list' ? 'invalid' : [
      document('groups/g/members/alice', { role: { stringValue: 'owner' }, status: { stringValue: 'active' } }),
      document('groups/g/members/bob', { role: { stringValue: 'member' }, status: { stringValue: 'revoked' } }),
    ] });
    if (path === 'groups/g/expenses') {
      const start = Number(url.searchParams.get('pageToken') ?? '0');
      return Response.json({ documents: Array.from({ length: Math.min(100, expenseCount - start) }, (_, offset) => {
        const index = start + offset;
        return document(`groups/g/expenses/e${index}`, {
      date: { stringValue: '2026-11-01' }, description: { stringValue: `Fictif ${index}` }, currency: { stringValue: 'CAD' },
      amountMinor: { integerValue: '101' }, categoryId: { stringValue: 'other' }, categoryLabel: { stringValue: 'Autre' },
      categoryIcon: { stringValue: 'receipt' }, categoryColor: { stringValue: 'slate' },
      payments: { arrayValue: { values: [{ mapValue: { fields: { userId: { stringValue: 'alice' }, amountMinor: { integerValue: '101' } } } }] } },
      allocations: { arrayValue: { values: [{ mapValue: { fields: { userId: { stringValue: 'alice' }, amountMinor: { integerValue: '101' } } } }] } },
      splitSnapshotJson: { stringValue: '{"kind":"equal","users":["alice"]}' }, createdBy: { stringValue: 'alice' }, deleted: { booleanValue: false },
        });
      }), ...(start + 100 < expenseCount ? { nextPageToken: String(start + 100) } : {}) });
    }
    if (path === 'users/alice/groupPreferences/g') return Response.json(document(path, {
      modeJson: { stringValue: '{"kind":"equal","users":["alice","bob"]}' },
      updatedAt: { timestampValue: '2026-11-16T18:00:00.000Z' },
    }));
    if (path === 'users/bob/groupPreferences/g' || path === 'users/alice/groupMemberships/g') return Response.json({}, { status: 404 });
    return Response.json({});
  };
  return { env, transport: withBatchGet(transport), get rollbacks() { return rollbacks; }, get transactionReads() { return transactionReads; } };
}

test('owner collects a coherent V2 JSON snapshot in one Firestore transaction', async () => {
  const state = await fixture();
  const result = JSON.parse(await collectBackupSnapshotV2('alice', 'g', state.env, state.transport));
  strictEqual(result.snapshotMode, 'server_transaction');
  strictEqual(result.preferences[0].modeJson.includes('equal'), true);
  strictEqual(result.preferences[1].modeJson, null);
  strictEqual(state.transactionReads > 5, true);
  strictEqual(state.rollbacks, 1);
});

test('owner can export the retained history of an archived group', async () => {
  const state = await fixture('owner', 0, 'archived');
  const result = JSON.parse(await collectBackupSnapshotV2('alice', 'g', state.env, state.transport));
  strictEqual(result.snapshotMode, 'server_transaction');
  strictEqual(state.rollbacks, 1);
});

test('ordinary member cannot collect another member’s preference', async () => {
  const state = await fixture('member');
  await rejects(collectBackupSnapshotV2('alice', 'g', state.env, state.transport),
    (error: unknown) => error instanceof BackupSnapshotError && error.status === 403);
  strictEqual(state.rollbacks, 1);
});

test('snapshot of 51 expenses stays below the Worker Free subrequest budget', async () => {
  const state = await fixture('owner', 51);
  const result = JSON.parse(await collectBackupSnapshotV2('alice', 'g', state.env, state.transport));
  strictEqual(result.expenses.length, 51);
  strictEqual(result.receipts.length, 1);
  strictEqual(result.comments.length, 1);
  strictEqual(state.transactionReads < 45, true);
  strictEqual(state.rollbacks, 1);
});

test('snapshot pages 936 synthetic expenses with a receipt and comment under the subrequest budget', async () => {
  const state = await fixture('owner', 936);
  const result = JSON.parse(await collectBackupSnapshotV2('alice', 'g', state.env, state.transport));
  strictEqual(result.expenses.length, 936);
  strictEqual(result.receipts.length, 1);
  strictEqual(result.comments.length, 1);
  strictEqual(state.transactionReads < 45, true);
});

test('snapshot refuses invalid paths and missing transaction before reading private data', async () => {
  const state = await fixture();
  await rejects(collectBackupSnapshotV2('bad/uid', 'g', state.env, state.transport), BackupSnapshotError);
  await rejects(collectBackupSnapshotV2('alice', 'bad/group', state.env, state.transport), BackupSnapshotError);
  strictEqual(state.transactionReads, 0);
  for (const failure of ['begin', 'transaction'] as const) {
    const broken = await fixture('owner', 0, 'active', failure);
    await rejects(collectBackupSnapshotV2('alice', 'g', broken.env, broken.transport), BackupSnapshotError);
    strictEqual(broken.rollbacks, 0);
  }
});

test('snapshot rejects malformed Firestore names, values and collection pages', async () => {
  for (const failure of ['bad-name', 'bad-field', 'unsafe-integer', 'unsupported-field', 'list'] as const) {
    const broken = await fixture('owner', 0, 'active', failure);
    await rejects(collectBackupSnapshotV2('alice', 'g', broken.env, broken.transport));
    strictEqual(broken.rollbacks, 1);
  }
});

test('failed read-only rollback preserves a valid exported snapshot', async () => {
  const state = await fixture('owner', 0, 'active', 'rollback');
  const result = JSON.parse(await collectBackupSnapshotV2('alice', 'g', state.env, state.transport));
  strictEqual(result.snapshotMode, 'server_transaction');
  strictEqual(state.rollbacks, 1);
});
