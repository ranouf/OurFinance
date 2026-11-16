import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createFxSettlement, FxSettlementError, parseFxSettlement } from '../src/fx-settlements';

const input = { idempotencyKey: '123e4567-e89b-42d3-a456-426614174002', date: '2026-11-16',
  debtCurrency: 'CAD', debtAmountMinor: 101, paymentCurrency: 'JPY', paymentAmountMinor: 1,
  rate: '0.5', rateDate: '2026-11-16', fromUserId: 'alice', toUserId: 'bob' };

test('FX parser requires explicit matching amounts, rate, date and sender', () => {
  deepStrictEqual(parseFxSettlement(input, 'alice'), input);
  for (const changed of [{ paymentAmountMinor: 2 }, { rate: '0' }, { rate: '1e2' }, { debtCurrency: 'JPY' },
    { paymentCurrency: 'CAD' }, { rateDate: '2026-02-30' }, { date: '2026-02-30' },
    { fromUserId: 'bob' }, { toUserId: 'alice' }, { debtAmountMinor: 0 }, { idempotencyKey: 'invalid' }]) {
    throws(() => parseFxSettlement({ ...input, ...changed }, 'alice'), FxSettlementError);
  }
});

async function fixture(revoked = false, conflict = false) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  const reads: string[] = [];
  let commit: any;
  let rollbacks = 0;
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    strictEqual(new Headers(options?.headers).get('Authorization'), 'Bearer service-token');
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.includes('?transaction=')) {
      reads.push(url);
      return Response.json({ fields: { status: { stringValue: revoked && url.includes('/members/bob') ? 'revoked' : 'active' } } });
    }
    if (url.endsWith(':commit')) { commit = JSON.parse(String(options?.body)); return conflict ? Response.json({ error: 'conflict' }, { status: 409 }) : Response.json({ writeResults: [{}, {}] }); }
    throw new Error('Requête inattendue');
  };
  return { env, reads, transport: transport as typeof fetch, committed: () => commit, rollbacks: () => rollbacks };
}

test('FX transaction checks members and atomically records both currencies and activity', async () => {
  const f = await fixture();
  strictEqual(await createFxSettlement(input, 'alice', 'g1', f.env, f.transport), input.idempotencyKey);
  strictEqual(f.reads.length, 3);
  const writes = f.committed().writes;
  strictEqual(writes.length, 2);
  strictEqual(writes[0].update.fields.debtAmountMinor.integerValue, '101');
  strictEqual(writes[0].update.fields.paymentAmountMinor.integerValue, '1');
  strictEqual(writes[0].update.fields.rate.stringValue, '0.5');
  strictEqual(writes[0].update.fields.debtCurrency.stringValue, 'CAD');
  strictEqual(writes[0].update.fields.paymentCurrency.stringValue, 'JPY');
  strictEqual(writes[1].update.name.endsWith(`/groups/g1/activity/fx_settlement_${input.idempotencyKey}`), true);
  strictEqual(f.rollbacks(), 0);
});

test('revoked recipient and commit conflict do not leave open transactions', async () => {
  const revoked = await fixture(true);
  await rejects(createFxSettlement(input, 'alice', 'g1', revoked.env, revoked.transport), (error: unknown) => error instanceof FxSettlementError && error.status === 403);
  strictEqual(revoked.committed(), undefined);
  strictEqual(revoked.rollbacks(), 1);
  const conflict = await fixture(false, true);
  await rejects(createFxSettlement(input, 'alice', 'g1', conflict.env, conflict.transport), (error: unknown) => error instanceof FxSettlementError && error.status === 409);
  strictEqual(conflict.rollbacks(), 1);
});
