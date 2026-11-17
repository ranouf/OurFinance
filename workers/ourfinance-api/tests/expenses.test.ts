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

test('suppression de dépense archive les reçus dans la transaction puis détruit leur asset privé', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }), CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'synthetic-key', CLOUDINARY_API_SECRET: 'synthetic-secret' };
  const attachmentId = 'receipt_1';
  const publicId = `ourfinance-test/g1/${input.idempotencyKey}/${attachmentId}`;
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

test('un échec Cloudinary après commit peut être repris sans recréer la dépense', async () => {
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
      if (!failedOnce) { failedOnce = true; return Response.json({}, { status: 503 }); }
      return Response.json({ result: 'not found' });
    }
    if (url.endsWith(':rollback')) return Response.json({});
    throw new Error(`Requête inattendue: ${url}`);
  };
  await rejects(mutateExpense({ expectedRevision: 0 }, 'alice', 'g1', input.idempotencyKey, 'DELETE', env, transport as typeof fetch), (error: unknown) => error instanceof ExpenseError && error.code === 'media_cleanup_failed');
  strictEqual(deleted, true);
  strictEqual(pending, true);
  await mutateExpense({ expectedRevision: 0 }, 'alice', 'g1', input.idempotencyKey, 'DELETE', env, transport as typeof fetch);
  strictEqual(commits, 1);
  strictEqual(pending, false);
});
