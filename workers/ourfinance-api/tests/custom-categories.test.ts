import { test } from 'node:test';
import { strictEqual, rejects } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { writeCategory, CategoryError } from '../src/custom-categories';

const categoryId = 'custom_123e4567-e89b-42d3-a456-426614174000';
const draft = { name: 'Frais de chalet', iconId: 'home', color: 'sky', status: 'active' };

async function environment() {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  return { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
}

test('un membre actif crée et archive une catégorie dans une transaction', async () => {
  const env = await environment();
  let commit: any;
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('/categories/') && url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    if (url.endsWith(':commit')) { commit = JSON.parse(String(options?.body)); return Response.json({ writeResults: [{}, {}] }); }
    throw new Error('Requête inattendue');
  };
  strictEqual(await writeCategory(draft, 'member', 'g1', categoryId, 'create', env, transport as typeof fetch), categoryId);
  strictEqual(commit.writes[0].update.fields.name.stringValue, 'Frais de chalet');
  strictEqual(commit.writes[0].update.fields.status.stringValue, 'active');
  strictEqual(commit.writes[1].update.fields.action.stringValue, 'category_created');
  await writeCategory({ ...draft, status: 'archived' }, 'member', 'g1', categoryId, 'update', env, transport as typeof fetch);
  strictEqual(commit.writes[0].update.fields.status.stringValue, 'archived');
  strictEqual(commit.writes[1].update.fields.action.stringValue, 'category_archived');
});

test('un membre révoqué et une catégorie système ne peuvent pas être modifiés', async () => {
  const env = await environment();
  let committed = false;
  const transport = async (resource: string | URL | Request) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('/members/member')) return Response.json({ fields: { status: { stringValue: 'revoked' } } });
    if (url.includes('?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    if (url.endsWith(':commit')) committed = true;
    return Response.json({});
  };
  await rejects(writeCategory(draft, 'member', 'g1', categoryId, 'create', env, transport as typeof fetch), (error: unknown) => error instanceof CategoryError && error.status === 403);
  await rejects(writeCategory(draft, 'member', 'g1', 'groceries', 'update', env, transport as typeof fetch), (error: unknown) => error instanceof CategoryError && error.status === 400);
  strictEqual(committed, false);
});
