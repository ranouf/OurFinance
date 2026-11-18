import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { deleteReceiptAsset, readLimitedBody } from '../src/media';

test('la lecture du reçu borne les octets réellement reçus, même sans Content-Length', async () => {
  const request = new Request('https://example.test/receipt', {
    method: 'POST', body: new Uint8Array([1, 2, 3]), duplex: 'half',
  } as RequestInit);
  const bytes = await readLimitedBody(request, 3);
  strictEqual(bytes.length, 3);
  strictEqual(bytes[2], 3);
  await rejects(readLimitedBody(new Request('https://example.test/receipt'), 3), /Corps absent/);
  const oversized = new Request('https://example.test/receipt', {
    method: 'POST', body: new Uint8Array([1, 2, 3, 4]), duplex: 'half',
  } as RequestInit);
  await rejects(readLimitedBody(oversized, 3), /Corps trop volumineux/);
});

test('la suppression logique du reçu préserve la reprise après refus Firestore', async () => {
  const env = {
    FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
    CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret',
  };
  let remoteCalls = 0;
  const refused = (async (resource: string | URL | Request) => {
    remoteCalls++;
    strictEqual(String(resource).endsWith(':commit'), true);
    return Response.json({}, { status: 409 });
  }) as typeof fetch;
  await rejects(deleteReceiptAsset('groups/g/expenses/e/attachments/a', 'ourfinance-test/g/e/a', false, 'token', env, refused), /Suppression logique refusée/);
  strictEqual(remoteCalls, 1);
});
