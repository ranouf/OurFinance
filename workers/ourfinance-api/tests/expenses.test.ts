import { test } from 'node:test';
import { deepStrictEqual, strictEqual, rejects, throws } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createExpense, ExpenseError, parseExpense } from '../src/expenses';
const input = {
  idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', description: 'Épicerie', currency: 'CAD', date: '2026-11-16', amountMinor: 101,
  payments: [{ userId: 'alice', amountMinor: 101 }], splitMode: { kind: 'equal', users: ['alice', 'bob'] },
};
test('expense parser rejects malformed and unbalanced inputs', () => {
  throws(() => parseExpense({ ...input, date: '2026-02-31' }), ExpenseError);
  throws(() => parseExpense({ ...input, payments: [{ userId: 'alice', amountMinor: 100 }] }), ExpenseError);
  throws(() => parseExpense({ ...input, splitMode: { kind: 'equal', users: [null] } }), ExpenseError);
  throws(() => parseExpense({ ...input, categoryId: 'unknown' }), ExpenseError);
  strictEqual(parseExpense({ ...input, categoryId: 'education' }).categoryId, 'education');
});
test('expense transaction reads active group/members and atomically writes expense, preference, activity', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const service = JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) });
  const readPaths: string[] = [];
  let commit: any;
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    strictEqual(new Headers(options?.headers).get('Authorization'), 'Bearer service-token');
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('?transaction=')) {
      readPaths.push(url);
      if (url.includes('/groups/g1/members/')) return Response.json({ fields: { status: { stringValue: 'active' } } });
      return Response.json({ fields: { status: { stringValue: 'active' } } });
    }
    if (url.endsWith(':commit')) { commit = JSON.parse(String(options?.body)); return Response.json({ writeResults: [{},{},{}] }); }
    throw new Error('Requête inattendue');
  };
  strictEqual(await createExpense({ ...input, categoryId: 'education' }, 'alice', 'g1', { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: service }, transport as typeof fetch), input.idempotencyKey);
  strictEqual(readPaths.length, 3);
  strictEqual(commit.transaction, 'txn');
  strictEqual(commit.writes.length, 3);
  strictEqual(commit.writes[0].currentDocument.exists, false);
  deepStrictEqual(commit.writes[0].update.fields.allocations.arrayValue.values.map((item: any) => item.mapValue.fields.amountMinor.integerValue), ['51','50']);
  strictEqual(commit.writes[0].update.fields.categoryId.stringValue, 'education');
  strictEqual(commit.writes[1].update.name.endsWith('/users/alice/groupPreferences/g1'), true);
  strictEqual(commit.writes[2].update.name.endsWith(`/groups/g1/activity/${input.idempotencyKey}`), true);
});
test('revoked participant prevents a commit', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const service = JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) });
  let committed = false;
  const transport = async (resource: string | URL | Request) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('/members/bob')) return Response.json({ fields: { status: { stringValue: 'revoked' } } });
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    if (url.endsWith(':commit')) committed = true;
    return Response.json({});
  };
  await rejects(createExpense(input, 'alice', 'g1', { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: service }, transport as typeof fetch), (error: unknown) => error instanceof ExpenseError && error.code === 'member_inactive');
  strictEqual(committed, false);
});

test('une catégorie personnalisée active est figée sur la dépense, une archive est refusée', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const service = JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) });
  const categoryId = 'custom_123e4567-e89b-42d3-a456-426614174000';
  let status = 'active';
  let commit: any;
  let rolledBack = false;
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('/categories/') && url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: status }, name: { stringValue: 'Frais de chalet' }, iconId: { stringValue: 'home' }, color: { stringValue: 'sky' } } });
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    if (url.endsWith(':commit')) { commit = JSON.parse(String(options?.body)); return Response.json({ writeResults: [{}, {}, {}] }); }
    if (url.endsWith(':rollback')) { rolledBack = true; return Response.json({}); }
    return Response.json({});
  };
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: service };
  await createExpense({ ...input, categoryId }, 'alice', 'g1', env, transport as typeof fetch);
  strictEqual(commit.writes[0].update.fields.categoryLabel.stringValue, 'Frais de chalet');
  strictEqual(commit.writes[0].update.fields.categoryIcon.stringValue, '🏠');
  status = 'archived'; commit = undefined;
  await rejects(createExpense({ ...input, categoryId }, 'alice', 'g1', env, transport as typeof fetch), (error: unknown) => error instanceof ExpenseError && error.code === 'category_unavailable');
  strictEqual(commit, undefined);
  strictEqual(rolledBack, true);
});
