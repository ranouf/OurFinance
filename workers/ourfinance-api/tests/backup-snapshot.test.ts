import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { collectBackupSnapshotV2, BackupSnapshotError } from '../src/backup-snapshot';

async function fixture(role: 'owner' | 'member' = 'owner', expenseCount = 0) {
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
      return Response.json({ transaction: 'snapshot-txn' });
    }
    if (url.pathname.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    const query = url.pathname.endsWith(':runQuery');
    if ((query ? JSON.parse(String(init?.body)).transaction : url.searchParams.get('transaction')) !== 'snapshot-txn') throw new Error('Lecture hors transaction');
    transactionReads++;
    if (query) return Response.json([]);
    const path = url.pathname.slice(`/v1/${root}/`.length);
    if (path === 'groups/g') return Response.json(document(path, { status: { stringValue: 'active' }, name: { stringValue: 'Fictif' }, currencyCode: { stringValue: 'CAD' } }));
    if (path === 'groups/g/members/alice') return Response.json(document(path, { status: { stringValue: 'active' }, role: { stringValue: role } }));
    if (path === 'groups/g/members') return Response.json({ documents: [
      document('groups/g/members/alice', { role: { stringValue: 'owner' }, status: { stringValue: 'active' } }),
      document('groups/g/members/bob', { role: { stringValue: 'member' }, status: { stringValue: 'revoked' } }),
    ] });
    if (path === 'groups/g/expenses') return Response.json({ documents: Array.from({ length: expenseCount }, (_, index) => document(`groups/g/expenses/e${index}`, {
      date: { stringValue: '2026-11-01' }, description: { stringValue: `Fictif ${index}` }, currency: { stringValue: 'CAD' },
      amountMinor: { integerValue: '101' }, categoryId: { stringValue: 'other' }, categoryLabel: { stringValue: 'Autre' },
      categoryIcon: { stringValue: 'receipt' }, categoryColor: { stringValue: 'slate' },
      payments: { arrayValue: { values: [{ mapValue: { fields: { userId: { stringValue: 'alice' }, amountMinor: { integerValue: '101' } } } }] } },
      allocations: { arrayValue: { values: [{ mapValue: { fields: { userId: { stringValue: 'alice' }, amountMinor: { integerValue: '101' } } } }] } },
      splitSnapshotJson: { stringValue: '{"kind":"equal","users":["alice"]}' }, createdBy: { stringValue: 'alice' }, deleted: { booleanValue: false },
    })) });
    if (path === 'users/alice/groupPreferences/g') return Response.json(document(path, {
      modeJson: { stringValue: '{"kind":"equal","users":["alice","bob"]}' },
      updatedAt: { timestampValue: '2026-11-16T18:00:00.000Z' },
    }));
    if (path === 'users/bob/groupPreferences/g' || path === 'users/alice/groupMemberships/g') return Response.json({}, { status: 404 });
    return Response.json({});
  };
  return { env, transport: transport as typeof fetch, get rollbacks() { return rollbacks; }, get transactionReads() { return transactionReads; } };
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
  strictEqual(state.transactionReads < 45, true);
  strictEqual(state.rollbacks, 1);
});
