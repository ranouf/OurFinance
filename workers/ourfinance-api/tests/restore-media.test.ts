import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { removeStagedRestoreReceipts, stageRestoreReceipts } from '../src/restore-media';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';
const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: 'synthetic', CLOUDINARY_API_SECRET: 'synthetic' };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);

test('staging keeps original receipt IDs and uses isolated private asset paths', async () => {
  const uploaded: string[] = [];
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const id = (init?.body as FormData).get('public_id') as string;
    if (String(resource).endsWith('/image/upload')) {
      uploaded.push(id);
      return Response.json({ public_id: id, type: 'authenticated', resource_type: 'image', format: 'png' });
    }
    throw new Error('Requête inattendue');
  };
  const staged = await stageRestoreReceipts('g', restoreId, [{ expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png }], env, transport as typeof fetch);
  deepStrictEqual(uploaded, [`ourfinance-test/g/e/restore_${restoreId}/a`]);
  strictEqual(staged[0].attachmentId, 'a');
  const production = await stageRestoreReceipts('g', restoreId, [{ expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png }],
    { ...env, FIREBASE_PROJECT_ID: 'ourfinance-prod' }, transport as typeof fetch);
  strictEqual(production[0].publicId, `ourfinance-prod/g/e/restore_${restoreId}/a`);
});

test('failed second upload triggers cleanup of staged and uncertain assets', async () => {
  const destroyed: string[] = [];
  let uploads = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const id = (init?.body as FormData).get('public_id') as string;
    if (String(resource).endsWith('/image/upload')) {
      uploads++;
      return uploads === 2 ? Response.json({}, { status: 403 }) : Response.json({ public_id: id, type: 'authenticated', resource_type: 'image', format: 'png' });
    }
    destroyed.push(id);
    return Response.json({ result: 'ok' });
  };
  await rejects(stageRestoreReceipts('g', restoreId, [
    { expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png },
    { expenseId: 'e', attachmentId: 'b', format: 'png', bytes: png },
  ], env, transport as typeof fetch));
  deepStrictEqual(new Set(destroyed), new Set([
    `ourfinance-test/g/e/restore_${restoreId}/a`, `ourfinance-test/g/e/restore_${restoreId}/b`,
  ]));
});

test('rejects redirected, duplicated or corrupt staged receipts before committing any staged list', async () => {
  const uploads: string[] = [];
  const transport = (async (resource: string | URL | Request, init?: RequestInit) => {
    const id = (init?.body as FormData).get('public_id') as string;
    if (String(resource).endsWith('/image/upload')) {
      uploads.push(id);
      return Response.json({ public_id: id, type: 'authenticated', resource_type: 'image', format: 'png' });
    }
    return Response.json({ result: 'ok' });
  }) as typeof fetch;
  for (const [group, id, rows] of [
    ['../g', restoreId, [{ expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png }]],
    ['g', 'invalid', [{ expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png }]],
    ['g', restoreId, Array.from({ length: 26 }, () => ({ expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png }))],
    ['g', restoreId, [{ expenseId: '../e', attachmentId: 'a', format: 'png', bytes: png }]],
    ['g', restoreId, [{ expenseId: 'e', attachmentId: 'a', format: 'png', bytes: new Uint8Array([1, 2, 3]) }]],
  ] as const) await rejects(stageRestoreReceipts(group, id, rows, env, transport));
  strictEqual(uploads.length, 0);
  await rejects(stageRestoreReceipts('g', restoreId, [
    { expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png },
    { expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png },
  ], env, transport), /Reçu/);
  strictEqual(uploads.length, 1);
});

test('failed cleanup keeps a durable staging failure and rejects incomplete explicit cleanup', async () => {
  const failing = (async (resource: string | URL | Request, init?: RequestInit) => {
    const id = (init?.body as FormData).get('public_id') as string;
    if (String(resource).endsWith('/image/upload')) return Response.json({ public_id: id, type: 'authenticated', resource_type: 'image', format: 'png' });
    return Response.json({}, { status: 503 });
  }) as typeof fetch;
  await rejects(stageRestoreReceipts('g', restoreId, [
    { expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png },
    { expenseId: 'e', attachmentId: 'a', format: 'png', bytes: png },
  ], env, failing), /Nettoyage/);
  await rejects(removeStagedRestoreReceipts([{ expenseId: 'e', attachmentId: 'a', format: 'png', publicId: `ourfinance-test/g/e/restore_${restoreId}/a` }], env, failing), /Nettoyage/);
});
