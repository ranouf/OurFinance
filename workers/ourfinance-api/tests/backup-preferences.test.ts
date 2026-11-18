import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { BackupPreferencesError, collectBackupPreferences } from '../src/backup-preferences';

async function fixture(options: { callerRole?: 'owner' | 'member'; callerStatus?: 'active' | 'revoked'; groupStatus?: 'active' | 'archived'; malformedPreference?: boolean; oldPreference?: boolean } = {}) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const root = 'projects/ourfinance-test/databases/(default)/documents';
  let rollbacks = 0;
  let listed = 0;
  const transport = async (resource: string | URL | Request) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.includes('/groups/g/members?')) {
      listed++;
      return Response.json({ documents: [
        { name: `${root}/groups/g/members/alice`, fields: { status: { stringValue: 'active' } } },
        { name: `${root}/groups/g/members/bob`, fields: { status: { stringValue: 'revoked' } } },
      ] });
    }
    if (url.includes('/groups/g/members/alice?')) return Response.json({ fields: { status: { stringValue: options.callerStatus ?? 'active' }, role: { stringValue: options.callerRole ?? 'owner' } } });
    if (url.includes('/groups/g?')) return Response.json({ fields: { status: { stringValue: options.groupStatus ?? 'active' } } });
    if (url.includes('/users/alice/groupPreferences/g?')) return Response.json({ fields: {
      modeJson: { stringValue: '{"kind":"equal","users":["alice","bob"]}' },
      ...(options.oldPreference ? {} : { memberIds: { arrayValue: { values: options.malformedPreference ? [{ integerValue: '1' }] : [{ stringValue: 'alice' }, { stringValue: 'bob' }] } } }),
      updatedAt: { timestampValue: '2026-11-16T18:00:00.123456Z' },
    } });
    if (url.includes('/users/bob/groupPreferences/g?')) return Response.json({}, { status: 404 });
    throw new Error(`Requête inattendue: ${url}`);
  };
  return { env, transport: transport as typeof fetch, get rollbacks() { return rollbacks; }, get listed() { return listed; } };
}

test('owner reads every member preference in one read-only transaction', async () => {
  const state = await fixture();
  const rows = await collectBackupPreferences('alice', 'g', state.env, state.transport);
  deepStrictEqual(rows.map(row => row.userId), ['alice', 'bob']);
  deepStrictEqual(rows[0].memberIds, ['alice', 'bob']);
  strictEqual(rows[0].updatedAt, '2026-11-16T18:00:00.123Z');
  strictEqual(rows[1].modeJson, null);
  strictEqual(state.listed, 1);
  strictEqual(state.rollbacks, 1);
});

test('owner can export preferences after group archival', async () => {
  const state = await fixture({ groupStatus: 'archived' });
  const rows = await collectBackupPreferences('alice', 'g', state.env, state.transport);
  strictEqual(rows.length, 2);
  strictEqual(state.rollbacks, 1);
});

test('legacy preference without memberIds derives participants from modeJson', async () => {
  const state = await fixture({ oldPreference: true });
  const rows = await collectBackupPreferences('alice', 'g', state.env, state.transport);
  deepStrictEqual(rows[0].memberIds, ['alice', 'bob']);
});

test('ordinary or revoked caller cannot list other members’ preferences', async () => {
  for (const options of [{ callerRole: 'member' as const }, { callerStatus: 'revoked' as const }]) {
    const state = await fixture(options);
    await rejects(collectBackupPreferences('alice', 'g', state.env, state.transport), (error: unknown) => error instanceof BackupPreferencesError && error.status === 403);
    strictEqual(state.listed, 0);
    strictEqual(state.rollbacks, 1);
  }
});

test('malformed preference fails the whole snapshot', async () => {
  const state = await fixture({ malformedPreference: true });
  await rejects(collectBackupPreferences('alice', 'g', state.env, state.transport), (error: unknown) => error instanceof BackupPreferencesError && error.code === 'invalid_preference');
  strictEqual(state.rollbacks, 1);
});
