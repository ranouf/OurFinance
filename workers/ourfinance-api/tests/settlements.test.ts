import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createSettlement, parseSettlement, SettlementError } from '../src/settlements';

const input = { idempotencyKey: '123e4567-e89b-42d3-a456-426614174001', date: '2026-11-16', currency: 'CAD', amountMinor: 51, fromUserId: 'alice', toUserId: 'bob' };
test('settlement parser requires sender identity, distinct recipient and exact minor units', () => {
  deepStrictEqual(parseSettlement(input, 'alice'), input);
  for (const changed of [
    { fromUserId: 'bob' }, { toUserId: 'alice' }, { amountMinor: 0 }, { amountMinor: 1.5 },
    { currency: 'ZZZ' }, { date: '2026-02-31' }, { idempotencyKey: 'invalid' },
  ]) throws(() => parseSettlement({ ...input, ...changed }, 'alice'), SettlementError);
});

async function fixture(revoked = false, conflict = false) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
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

test('transaction checks both active members and atomically records transfer plus activity', async () => {
  const f = await fixture();
  strictEqual(await createSettlement(input, 'alice', 'g1', f.env, f.transport), input.idempotencyKey);
  strictEqual(f.reads.length, 3);
  const commit = f.committed();
  strictEqual(commit.transaction, 'txn');
  strictEqual(commit.writes.length, 2);
  strictEqual(commit.writes.every((write: any) => write.currentDocument.exists === false), true);
  strictEqual(commit.writes[0].update.fields.amountMinor.integerValue, '51');
  strictEqual(commit.writes[0].update.fields.currency.stringValue, 'CAD');
  strictEqual(commit.writes[1].update.name.endsWith(`/groups/g1/activity/settlement_${input.idempotencyKey}`), true);
  strictEqual(f.rollbacks(), 0);
});

test('revoked recipient prevents any settlement write', async () => {
  const f = await fixture(true);
  await rejects(createSettlement(input, 'alice', 'g1', f.env, f.transport), (error: unknown) => error instanceof SettlementError && error.status === 403);
  strictEqual(f.committed(), undefined);
  strictEqual(f.rollbacks(), 1);
});

test('commit conflict is returned and its transaction is rolled back', async () => {
  const f = await fixture(false, true);
  await rejects(createSettlement(input, 'alice', 'g1', f.env, f.transport), (error: unknown) => error instanceof SettlementError && error.status === 409);
  strictEqual(f.rollbacks(), 1);
});
