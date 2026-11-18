import { test } from 'node:test';
import { deepStrictEqual, strictEqual, rejects, throws } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createExpense, ExpenseError, mutateExpense, parseExpense } from '../src/expenses';
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

test('expense parser rejects every malformed identifier, amount and payment boundary', () => {
  const invalid = [
    null, 'text', {},
    { ...input, idempotencyKey: 'not-a-v4-uuid' },
    { ...input, description: ' ' },
    { ...input, description: 'x'.repeat(161) },
    { ...input, categoryId: 1 },
    { ...input, currency: 'ZZZ' },
    { ...input, date: '16-11-2026' },
    { ...input, amountMinor: 0 },
    { ...input, amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { ...input, payments: [] },
    { ...input, payments: Array.from({ length: 21 }, () => ({ userId: 'alice', amountMinor: 1 })) },
    { ...input, splitMode: null },
  ];
  for (const value of invalid) throws(() => parseExpense(value), ExpenseError);
  for (const payments of [[null], [{ userId: 'bad/id', amountMinor: 101 }], [{ userId: 'alice', amountMinor: 1.5 }],
    [{ userId: 'alice', amountMinor: 50 }, { userId: 'alice', amountMinor: 51 }]]) {
    throws(() => parseExpense({ ...input, payments }), ExpenseError);
  }
});

test('expense parser validates all split modes and rejects malformed participants', () => {
  const modes = [
    { kind: 'equal', users: ['alice', 'bob'] },
    { kind: 'exact', amounts: [{ userId: 'alice', amountMinor: 51 }, { userId: 'bob', amountMinor: 50 }] },
    { kind: 'percentage', weightsBasisPoints: [{ userId: 'alice', value: 5000 }, { userId: 'bob', value: 5000 }] },
    { kind: 'shares', weights: [{ userId: 'alice', value: 1 }, { userId: 'bob', value: 1 }] },
    { kind: 'adjustment', adjustments: [{ userId: 'alice', amountMinor: 0 }, { userId: 'bob', amountMinor: 0 }] },
  ];
  for (const splitMode of modes) strictEqual(parseExpense({ ...input, splitMode }).splitMode, splitMode);
  for (const splitMode of [
    { kind: 'unknown' }, { kind: 'equal', users: [] }, { kind: 'equal', users: ['bad/id'] },
    { kind: 'exact', amounts: 'bad' }, { kind: 'percentage', weightsBasisPoints: [] },
    { kind: 'shares', weights: [] }, { kind: 'adjustment', adjustments: [] },
  ]) throws(() => parseExpense({ ...input, splitMode }), ExpenseError);
});

test('expense parser rejects every payment and split boundary without rounding money', () => {
  for (const value of [
    { ...input, description: 123 }, { ...input, idempotencyKey: 123 }, { ...input, currency: 123 },
    { ...input, date: 123 }, { ...input, amountMinor: 1.5 }, { ...input, payments: 'invalid' },
    { ...input, payments: [{ userId: 'alice', amountMinor: '101' }] },
    { ...input, payments: [{ amountMinor: 101 }] },
    { ...input, splitMode: 'equal' },
    { ...input, splitMode: { kind: 'equal', users: Array.from({ length: 21 }, (_, i) => `member_${i}`) } },
    { ...input, splitMode: { kind: 'exact', amounts: [{ userId: 'alice', amountMinor: 50 }] } },
    { ...input, splitMode: { kind: 'percentage', weightsBasisPoints: [{ userId: 'alice', value: 9000 }] } },
    { ...input, splitMode: { kind: 'shares', weights: [{ userId: 'alice', value: 0 }] } },
  ]) throws(() => parseExpense(value), ExpenseError, JSON.stringify(value));
});

test('expense mutations reject malformed revision or redirected identity before calling Firestore', async () => {
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: 'unused' };
  const transport = (async () => { throw new Error('No network expected'); }) as typeof fetch;
  for (const [body, uid, groupId, expenseId] of [
    [{ expectedRevision: 0 }, 'bad/uid', 'g1', input.idempotencyKey],
    [{ expectedRevision: 0 }, 'alice', '../g', input.idempotencyKey],
    [{ expectedRevision: 0 }, 'alice', 'g1', '../expense'],
    [null, 'alice', 'g1', input.idempotencyKey],
    [{ expectedRevision: -1 }, 'alice', 'g1', input.idempotencyKey],
    [{ expectedRevision: 1.5 }, 'alice', 'g1', input.idempotencyKey],
  ] as const) await rejects(mutateExpense(body, uid, groupId, expenseId, 'DELETE', env, transport), ExpenseError);
});

test('expense creation rejects redirected group and caller before obtaining a service token', async () => {
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: 'unused' };
  const transport = (async () => { throw new Error('No network expected'); }) as typeof fetch;
  await rejects(createExpense(input, 'bad/uid', 'g1', env, transport),
    (error: unknown) => error instanceof ExpenseError && error.code === 'invalid_group');
  await rejects(createExpense(input, 'alice', '../group', env, transport),
    (error: unknown) => error instanceof ExpenseError && error.code === 'invalid_group');
});

test('expense transactions fail closed on absent group, member, category and conflicting commit', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const categoryId = 'custom_123e4567-e89b-42d3-a456-426614174000';
  const scenarios: readonly [string, string][] = [
    ['group-missing', 'group_inactive'], ['group-archived', 'group_inactive'],
    ['member-missing', 'member_inactive'], ['category-missing', 'category_unavailable'],
    ['commit-conflict', 'transaction_conflict'],
  ];
  for (const [scenario, code] of scenarios) {
    let rollback = 0;
    const transport = (async (resource: string | URL | Request) => {
      const url = String(resource);
      if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
      if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
      if (url.endsWith(':rollback')) { rollback++; return Response.json({}); }
      if (url.endsWith(':commit')) return Response.json({}, { status: scenario === 'commit-conflict' ? 409 : 200 });
      if (url.includes('/categories/')) return scenario === 'category-missing' ? Response.json({}, { status: 404 }) : Response.json({ fields: { status: { stringValue: 'active' }, name: { stringValue: 'Fictif' }, iconId: { stringValue: 'home' }, color: { stringValue: 'sky' } } });
      if (url.includes('/members/')) return scenario === 'member-missing' ? Response.json({}, { status: 404 }) : Response.json({ fields: { status: { stringValue: 'active' } } });
      if (url.includes('/groups/g1?')) return scenario === 'group-missing' ? Response.json({}, { status: 404 }) : Response.json({ fields: { status: { stringValue: scenario === 'group-archived' ? 'archived' : 'active' }, currencyCode: { stringValue: 'CAD' } } });
      throw new Error(`Unexpected request ${url}`);
    }) as typeof fetch;
    await rejects(createExpense({ ...input, categoryId }, 'alice', 'g1', env, transport),
      (error: unknown) => error instanceof ExpenseError && error.code === code);
    strictEqual(rollback, 1, scenario);
  }
});

test('expense deletion refuses malformed receipt inventories and unavailable cleanup credentials', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const root = `projects/ourfinance-test/databases/(default)/documents/groups/g1/expenses/${input.idempotencyKey}/attachments`;
  const scenarios: readonly [unknown, string][] = [
    [{ documents: 'invalid' }, 'invalid_receipts'],
    [{ nextPageToken: 'more' }, 'too_many_receipts'],
    [{ documents: Array.from({ length: 51 }, (_, i) => ({ name: `${root}/item_${i}` })) }, 'too_many_receipts'],
    [{ documents: [{ name: 'outside/receipt', fields: {} }] }, 'invalid_receipts'],
    [{ documents: [{ name: `${root}/a` }] }, 'invalid_receipts'],
    [{ documents: [{ name: `${root}/bad%id`, fields: { status: { stringValue: 'active' }, type: { stringValue: 'authenticated' }, publicId: { stringValue: `ourfinance-test/g1/${input.idempotencyKey}/bad%id` } } }] }, 'invalid_receipts'],
    [{ documents: [{ name: `${root}/a`, fields: { status: { stringValue: 'active' }, publicId: { stringValue: `ourfinance-test/g1/${input.idempotencyKey}/a` } } }] }, 'invalid_receipts'],
    [{ documents: [{ name: `${root}/a`, fields: { status: { stringValue: 'active' }, type: { stringValue: 'authenticated' }, publicId: { stringValue: 'outside/g1/e/a' } } }] }, 'invalid_receipts'],
    [{ documents: [{ name: `${root}/a`, fields: { status: { stringValue: 'active' }, type: { stringValue: 'authenticated' }, publicId: { stringValue: `ourfinance-test/g1/${input.idempotencyKey}/a` } } }] }, 'media_cleanup_unavailable'],
  ];
  for (const [inventory, code] of scenarios) {
    let commits = 0;
    let rollbacks = 0;
    const transport = (async (resource: string | URL | Request) => {
      const url = String(resource);
      if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
      if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
      if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
      if (url.endsWith(':commit')) { commits++; return Response.json({}); }
      if (url.includes('/attachments?')) return Response.json(inventory);
      if (url.includes('/expenses/') && url.includes('?transaction=')) return Response.json({ fields: { createdBy: { stringValue: 'alice' }, deleted: { booleanValue: false }, revision: { integerValue: '0' } } });
      if (url.includes('/members/') && url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
      if (url.includes('/groups/g1?')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } } });
      throw new Error(`Unexpected request ${url}`);
    }) as typeof fetch;
    await rejects(mutateExpense({ expectedRevision: 0 }, 'alice', 'g1', input.idempotencyKey, 'DELETE', env, transport),
      (error: unknown) => error instanceof ExpenseError && error.code === code);
    strictEqual(commits, 0, code);
    strictEqual(rollbacks, 1, code);
  }
});

test('expense updates reject changed group, member, author, revision and category before commit', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const categoryId = 'custom_123e4567-e89b-42d3-a456-426614174000';
  const cases: readonly [string, string][] = [
    ['group', 'group_inactive'], ['currency', 'currency_mismatch'], ['member', 'member_inactive'],
    ['author', 'author_required'], ['revision', 'revision_conflict'], ['deleted', 'expense_deleted'],
    ['category', 'category_unavailable'],
  ];
  for (const [scenario, code] of cases) {
    let commits = 0;
    const transport = (async (resource: string | URL | Request) => {
      const url = String(resource);
      if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
      if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
      if (url.endsWith(':rollback')) return Response.json({});
      if (url.endsWith(':commit')) { commits++; return Response.json({}); }
      if (url.includes('/categories/')) return scenario === 'category' ? Response.json({}, { status: 404 }) : Response.json({ fields: { status: { stringValue: 'active' }, name: { stringValue: 'Fictif' }, iconId: { stringValue: 'home' }, color: { stringValue: 'sky' } } });
      if (url.includes('/expenses/') && url.includes('?transaction=')) return Response.json({ fields: { createdBy: { stringValue: scenario === 'author' ? 'other' : 'alice' }, deleted: { booleanValue: scenario === 'deleted' }, revision: { integerValue: scenario === 'revision' ? '1' : '0' }, categoryId: { stringValue: 'other' } } });
      if (url.includes('/members/')) return Response.json({ fields: { status: { stringValue: scenario === 'member' ? 'revoked' : 'active' } } });
      if (url.includes('/groups/g1?')) return Response.json({ fields: { status: { stringValue: scenario === 'group' ? 'archived' : 'active' }, currencyCode: { stringValue: scenario === 'currency' ? 'JPY' : 'CAD' } } });
      throw new Error(`Unexpected request ${url}`);
    }) as typeof fetch;
    await rejects(mutateExpense({ ...input, categoryId, expectedRevision: 0 }, 'alice', 'g1', input.idempotencyKey, 'PATCH', env, transport),
      (error: unknown) => error instanceof ExpenseError && error.code === code);
    strictEqual(commits, 0, scenario);
  }
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
      return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } } });
    }
    if (url.endsWith(':commit')) { commit = JSON.parse(String(options?.body)); return Response.json({ writeResults: [{},{},{}] }); }
    throw new Error('Requête inattendue');
  };
  strictEqual(await createExpense({ ...input, categoryId: 'education' }, 'alice', 'g1', { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: service }, transport as typeof fetch), input.idempotencyKey);
  strictEqual(readPaths.length, 3);
  strictEqual(commit.transaction, 'txn');
  strictEqual(commit.writes.length, 4);
  strictEqual(commit.writes[0].currentDocument.exists, false);
  deepStrictEqual(commit.writes[0].update.fields.allocations.arrayValue.values.map((item: any) => item.mapValue.fields.amountMinor.integerValue), ['51','50']);
  strictEqual(commit.writes[0].update.fields.categoryId.stringValue, 'education');
  strictEqual(commit.writes[1].update.name.endsWith('/users/alice/groupPreferences/g1'), true);
  strictEqual(commit.writes[2].update.name.endsWith(`/groups/g1/activity/${input.idempotencyKey}`), true);
  strictEqual(commit.writes[3].updateMask.fieldPaths[0], 'currencyLockedAt');
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
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } } });
    if (url.endsWith(':commit')) committed = true;
    return Response.json({});
  };
  await rejects(createExpense(input, 'alice', 'g1', { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: service }, transport as typeof fetch), (error: unknown) => error instanceof ExpenseError && error.code === 'member_inactive');
  strictEqual(committed, false);
});

test('Firestore quota exhaustion has an explicit fixed code', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const service = JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) });
  const transport = async (resource: string | URL | Request) => String(resource).includes('oauth2.googleapis.com')
    ? Response.json({ access_token: 'service-token' })
    : Response.json({ message: 'private provider detail' }, { status: 429 });
  await rejects(createExpense(input, 'alice', 'g1', { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: service }, transport as typeof fetch),
    (error: unknown) => error instanceof ExpenseError && error.status === 503 && error.code === 'provider_quota_exceeded');
});

test('an expense in another currency is denied before commit and rolled back', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const service = JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) });
  let committed = false;
  let rolledBack = false;
  const transport = async (resource: string | URL | Request) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.endsWith(':rollback')) { rolledBack = true; return Response.json({}); }
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'JPY' } } });
    if (url.endsWith(':commit')) committed = true;
    return Response.json({});
  };
  await rejects(createExpense(input, 'alice', 'g1', { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: service }, transport as typeof fetch), (error: unknown) => error instanceof ExpenseError && error.code === 'currency_mismatch');
  strictEqual(committed, false);
  strictEqual(rolledBack, true);
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
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } } });
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

test('l’auteur modifie puis supprime logiquement sa dépense avec révision et activité atomiques', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  let revision = 0;
  let deleted = false;
  const commits: any[] = [];
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('/expenses/') && url.includes('?transaction=')) return Response.json({ fields: { createdBy: { stringValue: 'alice' }, deleted: { booleanValue: deleted }, revision: { integerValue: String(revision) }, categoryId: { stringValue: 'groceries' }, categoryLabel: { stringValue: 'Épicerie' }, categoryIcon: { stringValue: '🛒' }, categoryColor: { stringValue: 'teal' } } });
    if (url.includes('/members/') && url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } } });
    if (url.endsWith(':commit')) {
      const commit = JSON.parse(String(options?.body)); commits.push(commit);
      revision = Number(commit.writes[0].update.fields.revision.integerValue);
      deleted = commit.writes[0].update.fields.deleted?.booleanValue ?? false;
      return Response.json({ writeResults: [{}, {}] });
    }
    if (url.endsWith(':rollback')) return Response.json({});
    throw new Error('Requête inattendue');
  };
  const update = { ...input, categoryId: 'groceries', description: 'Courses modifiées', expectedRevision: 0 };
  await mutateExpense(update, 'alice', 'g1', input.idempotencyKey, 'PATCH', env, transport as typeof fetch);
  strictEqual(revision, 1);
  strictEqual(commits[0].writes[0].update.fields.description.stringValue, 'Courses modifiées');
  strictEqual(commits[0].writes[1].update.fields.action.stringValue, 'expense_updated');
  await rejects(mutateExpense(update, 'alice', 'g1', input.idempotencyKey, 'PATCH', env, transport as typeof fetch), (error: unknown) => error instanceof ExpenseError && error.code === 'revision_conflict');
  await rejects(mutateExpense({ expectedRevision: 1 }, 'bob', 'g1', input.idempotencyKey, 'DELETE', env, transport as typeof fetch), (error: unknown) => error instanceof ExpenseError && error.code === 'author_required');
  strictEqual(commits.length, 1);
  await mutateExpense({ expectedRevision: 1 }, 'alice', 'g1', input.idempotencyKey, 'DELETE', env, transport as typeof fetch);
  strictEqual(deleted, true);
  strictEqual(commits[1].writes[1].update.fields.action.stringValue, 'expense_deleted');
  await rejects(mutateExpense({ expectedRevision: 2 }, 'alice', 'g1', input.idempotencyKey, 'DELETE', env, transport as typeof fetch), (error: unknown) => error instanceof ExpenseError && error.code === 'expense_deleted');
  strictEqual(commits.length, 2);
});

for (const restored of [false, true]) test(`suppression de dépense archive et détruit un reçu ${restored ? 'restauré' : 'original'}`, async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }), CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'synthetic-key', CLOUDINARY_API_SECRET: 'synthetic-secret' };
  const attachmentId = 'receipt_1';
  const publicId = `ourfinance-test/g1/${input.idempotencyKey}/${restored ? 'restore_123e4567-e89b-42d3-a456-426614174000/' : ''}${attachmentId}`;
  let commit: any;
  let destroyed = false;
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('/attachments?')) return Response.json({ documents: [{ name: `projects/ourfinance-test/databases/(default)/documents/groups/g1/expenses/${input.idempotencyKey}/attachments/${attachmentId}`, fields: { status: { stringValue: 'active' }, type: { stringValue: 'authenticated' }, publicId: { stringValue: publicId } } }] });
    if (url.includes('/attachments/') && options?.method === 'PATCH') return Response.json({});
    if (url.includes('/expenses/') && url.includes('?transaction=')) return Response.json({ fields: { createdBy: { stringValue: 'alice' }, deleted: { booleanValue: false }, revision: { integerValue: '0' } } });
    if (url.includes('/members/') && url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } } });
    if (url.endsWith(':commit')) { commit = JSON.parse(String(options?.body)); return Response.json({ writeResults: [{}, {}, {}] }); }
    if (url.includes('api.cloudinary.com') && url.endsWith('/image/destroy')) { destroyed = true; return Response.json({ result: 'ok' }); }
    if (url.endsWith(':rollback')) return Response.json({});
    throw new Error(`Requête inattendue: ${url}`);
  };
  await mutateExpense({ expectedRevision: 0 }, 'alice', 'g1', input.idempotencyKey, 'DELETE', env, transport as typeof fetch);
  strictEqual(commit.writes.length, 3);
  strictEqual(commit.writes[0].update.fields.deleted.booleanValue, true);
  strictEqual(commit.writes[2].update.fields.status.stringValue, 'deleted');
  strictEqual(commit.writes[2].update.fields.cleanupPending.booleanValue, true);
  strictEqual(destroyed, true);
});

test('un échec ou quota Cloudinary après commit peut être repris sans recréer la dépense', async () => {
  for (const upstreamStatus of [503, 429]) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }), CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'synthetic-key', CLOUDINARY_API_SECRET: 'synthetic-secret' };
  const attachmentId = 'receipt_1';
  const publicId = `ourfinance-test/g1/${input.idempotencyKey}/${attachmentId}`;
  let deleted = false;
  let pending = false;
  let failedOnce = false;
  let commits = 0;
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('/attachments?')) return Response.json({ documents: [{ name: `projects/ourfinance-test/databases/(default)/documents/groups/g1/expenses/${input.idempotencyKey}/attachments/${attachmentId}`, fields: { status: { stringValue: deleted ? 'deleted' : 'active' }, cleanupPending: { booleanValue: pending }, type: { stringValue: 'authenticated' }, publicId: { stringValue: publicId } } }] });
    if (url.includes('/attachments/') && options?.method === 'PATCH') { pending = false; return Response.json({}); }
    if (url.includes('/expenses/') && url.includes('?transaction=')) return Response.json({ fields: { createdBy: { stringValue: 'alice' }, deleted: { booleanValue: deleted }, revision: { integerValue: deleted ? '1' : '0' } } });
    if (url.includes('/members/') && url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' }, currencyCode: { stringValue: 'CAD' } } });
    if (url.endsWith(':commit')) { commits++; deleted = true; pending = true; return Response.json({}); }
    if (url.includes('api.cloudinary.com') && url.endsWith('/image/destroy')) {
      if (!failedOnce) { failedOnce = true; return Response.json({}, { status: upstreamStatus }); }
      return Response.json({ result: 'not found' });
    }
    if (url.endsWith(':rollback')) return Response.json({});
    throw new Error(`Requête inattendue: ${url}`);
  };
  await rejects(mutateExpense({ expectedRevision: 0 }, 'alice', 'g1', input.idempotencyKey, 'DELETE', env, transport as typeof fetch),
    (error: unknown) => error instanceof ExpenseError && error.code === (upstreamStatus === 429 ? 'provider_quota_exceeded' : 'media_cleanup_failed'));
  strictEqual(deleted, true);
  strictEqual(pending, true);
  await mutateExpense({ expectedRevision: 0 }, 'alice', 'g1', input.idempotencyKey, 'DELETE', env, transport as typeof fetch);
  strictEqual(commits, 1);
  strictEqual(pending, false);
  }
});
