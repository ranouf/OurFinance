import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { changeGroupCurrency, GroupCurrencyError } from '../src/group-currency';

async function fixture(options: { owner?: boolean; locked?: boolean; archivedExpense?: boolean; archivedSettlement?: boolean; importedHistory?: boolean; missingGroup?: boolean; missingMember?: boolean; legacyCurrency?: boolean; failCommit?: boolean } = {}) {
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
    if (url.endsWith(':commit')) { commit = JSON.parse(String(init?.body)); return Response.json({ writeResults: [{}] }, { status: options.failCommit ? 409 : 200 }); }
    if (url.includes('/members/alice?')) return options.missingMember ? Response.json({}, { status: 404 }) : Response.json({ fields: { status: { stringValue: 'active' }, role: { stringValue: options.owner === false ? 'member' : 'owner' } } });
    if (url.includes('/groups/g1?')) return options.missingGroup ? Response.json({}, { status: 404 }) : Response.json({ fields: { status: { stringValue: 'active' }, ...(options.legacyCurrency ? { currency: { stringValue: 'CAD' } } : { currencyCode: { stringValue: 'CAD' } }), ...(options.locked ? { currencyLockedAt: { timestampValue: '2026-01-01T00:00:00Z' } } : {}) } });
    if (url.includes('/expenses?')) return Response.json(options.archivedExpense ? { documents: [{ name: 'archived' }] } : {});
    if (url.includes('/settlements?')) return Response.json(options.archivedSettlement ? { documents: [{ name: 'settlement' }] } : {});
    if (url.includes('/importedRecords?')) return Response.json(options.importedHistory ? { documents: [{ name: 'imported' }] } : {});
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

test('currency change rejects invalid identities, unknown currencies and absent ownership before writing', async () => {
  const f = await fixture();
  for (const [value, uid, groupId] of [
    [{ currencyCode: 'CAD' }, '../alice', 'g1'], [{ currencyCode: 'CAD' }, 'alice', '../g'],
    [{ currencyCode: 'zzz' }, 'alice', 'g1'], [{ currencyCode: 'ZZZ' }, 'alice', 'g1'],
    [null, 'alice', 'g1'],
  ] as const) await rejects(changeGroupCurrency(value, uid, groupId, f.env, f.transport), (error: unknown) => error instanceof GroupCurrencyError && error.status === 400);
  for (const options of [{ missingGroup: true }, { missingMember: true }]) {
    const state = await fixture(options);
    await rejects(changeGroupCurrency({ currencyCode: 'JPY' }, 'alice', 'g1', state.env, state.transport),
      (error: unknown) => error instanceof GroupCurrencyError && error.status === 403);
    strictEqual(state.rollbacks(), 1);
  }
});

test('legacy currency and retained settlement or import history respect the permanent lock', async () => {
  const unchanged = await fixture({ legacyCurrency: true });
  await changeGroupCurrency({ currencyCode: 'CAD' }, 'alice', 'g1', unchanged.env, unchanged.transport);
  strictEqual(unchanged.commit(), undefined);
  strictEqual(unchanged.rollbacks(), 1);
  for (const options of [{ archivedSettlement: true }, { importedHistory: true }]) {
    const state = await fixture(options);
    await rejects(changeGroupCurrency({ currencyCode: 'JPY' }, 'alice', 'g1', state.env, state.transport),
      (error: unknown) => error instanceof GroupCurrencyError && error.code === 'currency_locked');
    strictEqual(state.commit(), undefined);
  }
  const conflict = await fixture({ failCommit: true });
  await rejects(changeGroupCurrency({ currencyCode: 'JPY' }, 'alice', 'g1', conflict.env, conflict.transport),
    (error: unknown) => error instanceof GroupCurrencyError && error.code === 'transaction_conflict');
  strictEqual(conflict.rollbacks(), 1);
});
