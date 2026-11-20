import { withBatchGet } from './batch-get-mock';
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

test('settlement parser rejects missing records, unsafe IDs and invalid dates', () => {
  for (const value of [null, 'text', {}, { ...input, date: '2026-11-16T00:00:00Z' },
    { ...input, toUserId: 'bad/id' }, { ...input, toUserId: 42 }, { ...input, amountMinor: Number.MAX_SAFE_INTEGER + 1 }]) {
    throws(() => parseSettlement(value, 'alice'), SettlementError);
  }
  throws(() => parseSettlement(input, 'bad/uid'), SettlementError);
});

async function fixture(revoked = false, conflict = false, groupCurrency = 'CAD', options: {
  groupStatus?: string; currencyLocked?: boolean; beginStatus?: number; missingTransaction?: boolean;
  readStatus?: number; rollbackThrows?: boolean;
} = {}) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const reads: string[] = [];
  let commit: any;
  let rollbacks = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer service-token');
    if (url.endsWith(':beginTransaction')) return Response.json(options.missingTransaction ? {} : { transaction: 'txn' }, { status: options.beginStatus ?? 200 });
    if (url.endsWith(':rollback')) { rollbacks++; if (options.rollbackThrows) throw new Error('network'); return Response.json({}); }
    if (url.includes('?transaction=')) {
      reads.push(url);
      if (options.readStatus) return Response.json({}, { status: options.readStatus });
      return Response.json({ fields: { status: { stringValue: url.includes('/members/bob') && revoked ? 'revoked' : url.includes('/groups/g1?') ? options.groupStatus ?? 'active' : 'active' },
        currencyCode: { stringValue: groupCurrency }, ...(options.currencyLocked ? { currencyLockedAt: { stringValue: '2026-11-18' } } : {}) } });
    }
    if (url.endsWith(':commit')) { commit = JSON.parse(String(init?.body)); return conflict ? Response.json({ error: 'conflict' }, { status: 409 }) : Response.json({ writeResults: [{}, {}] }); }
    throw new Error('Requête inattendue');
  };
  return { env, reads, transport: withBatchGet(transport), committed: () => commit, rollbacks: () => rollbacks };
}

test('transaction checks both active members and atomically records transfer plus activity', async () => {
  const f = await fixture();
  strictEqual(await createSettlement(input, 'alice', 'g1', f.env, f.transport), input.idempotencyKey);
  strictEqual(f.reads.length, 3);
  const commit = f.committed();
  strictEqual(commit.transaction, 'txn');
  strictEqual(commit.writes.length, 3);
  strictEqual(commit.writes.slice(0, 2).every((write: any) => write.currentDocument.exists === false), true);
  strictEqual(commit.writes[0].update.fields.amountMinor.integerValue, '51');
  strictEqual(commit.writes[0].update.fields.currency.stringValue, 'CAD');
  strictEqual(commit.writes[1].update.name.endsWith(`/groups/g1/activity/settlement_${input.idempotencyKey}`), true);
  strictEqual(commit.writes[2].updateMask.fieldPaths[0], 'currencyLockedAt');
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

test('a settlement in another currency is rejected before any write', async () => {
  const f = await fixture(false, false, 'JPY');
  await rejects(createSettlement(input, 'alice', 'g1', f.env, f.transport), (error: unknown) => error instanceof SettlementError && error.code === 'currency_mismatch');
  strictEqual(f.committed(), undefined);
  strictEqual(f.rollbacks(), 1);
});

test('transaction refuses inactive group and malformed or unavailable Firestore state', async () => {
  const inactive = await fixture(false, false, 'CAD', { groupStatus: 'archived' });
  await rejects(createSettlement(input, 'alice', 'g1', inactive.env, inactive.transport),
    (error: unknown) => error instanceof SettlementError && error.code === 'group_inactive');
  strictEqual(inactive.rollbacks(), 1);
  for (const options of [{ beginStatus: 503 }, { missingTransaction: true }, { readStatus: 503 }]) {
    const f = await fixture(false, false, 'CAD', options);
    await rejects(createSettlement(input, 'alice', 'g1', f.env, f.transport), SettlementError);
    strictEqual(f.committed(), undefined);
  }
});

test('existing currency lock is preserved and a failed rollback keeps original conflict', async () => {
  const locked = await fixture(false, false, 'CAD', { currencyLocked: true });
  await createSettlement(input, 'alice', 'g1', locked.env, locked.transport);
  strictEqual(locked.committed().writes.length, 2);
  const conflicted = await fixture(false, true, 'CAD', { rollbackThrows: true });
  await rejects(createSettlement(input, 'alice', 'g1', conflicted.env, conflicted.transport),
    (error: unknown) => error instanceof SettlementError && error.code === 'transaction_conflict');
  strictEqual(conflicted.rollbacks(), 1);
  await rejects(createSettlement(input, 'alice', 'bad/group', locked.env, locked.transport), SettlementError);
});
