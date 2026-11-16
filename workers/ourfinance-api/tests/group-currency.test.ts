import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { changeGroupCurrency, GroupCurrencyError } from '../src/group-currency';

async function fixture(options: { owner?: boolean; locked?: boolean; archivedExpense?: boolean } = {}) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  let commit: any;
  let rollbacks = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer service-token');
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.endsWith(':commit')) { commit = JSON.parse(String(init?.body)); return Response.json({ writeResults: [{}] }); }
    if (url.includes('/members/alice?')) return Response.json({ fields: { status: { stringValue: 'active' }, role: { stringValue: options.owner === false ? 'member' : 'owner' } } });
    if (url.includes('/groups/g1?')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' }, ...(options.locked ? { currencyLockedAt: { timestampValue: '2026-01-01T00:00:00Z' } } : {}) } });
    if (url.includes('/expenses?')) return Response.json(options.archivedExpense ? { documents: [{ name: 'archived' }] } : {});
    if (url.includes('/settlements?') || url.includes('/importedRecords?')) return Response.json({});
    throw new Error(`Unexpected request: ${url}`);
  };
  return { env, transport: transport as typeof fetch, commit: () => commit, rollbacks: () => rollbacks };
}

test('owner changes currency before the first operation, in one transaction', async () => {
  const f = await fixture();
  await changeGroupCurrency({ currencyCode: 'JPY' }, 'alice', 'g1', f.env, f.transport);
  strictEqual(f.commit().writes[0].update.fields.currencyCode.stringValue, 'JPY');
  strictEqual(f.commit().writes[0].update.fields.currency.stringValue, 'JPY');
  strictEqual(f.rollbacks(), 0);
});

test('a past archived transaction or lock permanently prevents currency change', async () => {
  for (const options of [{ archivedExpense: true }, { locked: true }]) {
    const f = await fixture(options);
    await rejects(changeGroupCurrency({ currencyCode: 'JPY' }, 'alice', 'g1', f.env, f.transport), (error: unknown) => error instanceof GroupCurrencyError && error.code === 'currency_locked');
    strictEqual(f.commit(), undefined);
    strictEqual(f.rollbacks(), 1);
  }
});

test('ordinary member cannot change group currency', async () => {
  const f = await fixture({ owner: false });
  await rejects(changeGroupCurrency({ currencyCode: 'JPY' }, 'alice', 'g1', f.env, f.transport), (error: unknown) => error instanceof GroupCurrencyError && error.code === 'owner_required');
  strictEqual(f.commit(), undefined);
});
