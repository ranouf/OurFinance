import { test } from 'node:test';
import { strictEqual, throws, rejects } from 'node:assert';
import { createHash } from 'node:crypto';
import { authenticatedDownloadUrl, destroyAuthenticated, imageFormat, signCloudinary, uploadAuthenticated } from '../src/cloudinary';
import { ProviderQuotaError } from '../src/provider-quota';
import { handleRequest } from '../src/index';
const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' };
test('Cloudinary signature uses sorted non-secret parameters and SHA-1', async () => {
  const params = { type: 'authenticated', public_id: 'sample', timestamp: '123' };
  const expected = createHash('sha1').update('public_id=sample&timestamp=123&type=authenticatedsecret').digest('hex');
  strictEqual(await signCloudinary(params, 'secret'), expected);
});
test('private download URL is short lived and never returned directly by media route', async () => {
  const url = await authenticatedDownloadUrl('ourfinance-test/g/e/a', 'png', env, 1000);
  strictEqual(url.hostname, 'api.cloudinary.com');
  strictEqual(url.searchParams.get('type'), 'authenticated');
  strictEqual(url.searchParams.get('expires_at'), '1060');
  const response = await handleRequest(new Request('https://worker.example/groups/g/expenses/e/attachments/a'), { FIREBASE_PROJECT_ID: 'ourfinance-test', ALLOWED_ORIGIN: 'https://ourfinance-test.web.app', FIREBASE_SERVICE_ACCOUNT_JSON: 'configured', ...env });
  strictEqual(response.status, 503);
});
test('only small JPEG/PNG files pass the magic-byte check', () => {
  const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
  strictEqual(imageFormat(png, 'image/png'), 'png');
  throws(() => imageFormat(png, 'image/jpeg'));
  throws(() => imageFormat(new Uint8Array(2_000_001), 'image/png'));
});
test('upload requests authenticated delivery type and validates response', async () => {
  const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
  const transport = async (_input: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    strictEqual(form.get('type'), 'authenticated');
    strictEqual(form.get('public_id'), 'ourfinance-test/g/e/a');
    strictEqual(form.get('asset_folder'), 'ourfinance-test');
    const timestamp = form.get('timestamp');
    strictEqual(form.get('signature'), createHash('sha1').update(`asset_folder=ourfinance-test&overwrite=false&public_id=ourfinance-test/g/e/a&timestamp=${timestamp}&type=authenticatedsecret`).digest('hex'));
    return Response.json({ public_id: 'ourfinance-test/g/e/a', type: 'authenticated', resource_type: 'image', format: 'png' });
  };
  await uploadAuthenticated(png, 'png', 'ourfinance-test/g/e/a', env, transport as typeof fetch);
});
test('Cloudinary quota refusals expose only a fixed public error', async () => {
  const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
  const limited = async () => Response.json({ error: { message: 'private upstream detail' } }, { status: 429 });
  await rejects(uploadAuthenticated(png, 'png', 'ourfinance-test/g/e/a', env, limited as typeof fetch),
    (error: unknown) => error instanceof ProviderQuotaError && error.message === 'provider_quota_exceeded');
  await rejects(destroyAuthenticated('ourfinance-test/g/e/a', env, limited as typeof fetch),
    (error: unknown) => error instanceof ProviderQuotaError && error.message === 'provider_quota_exceeded');
});
test('failed metadata persistence can remove authenticated upload', async () => {
  const { destroyAuthenticated } = await import('../src/cloudinary');
  const transport = async (_input: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    strictEqual(form.get('type'), 'authenticated');
    strictEqual(form.get('public_id'), 'ourfinance-test/g/e/a');
    return Response.json({ result: 'ok' });
  };
  await destroyAuthenticated('ourfinance-test/g/e/a', env, transport as typeof fetch);
});
test('streaming upload refuses a body beyond the limit', async () => {
  const { readLimitedBody } = await import('../src/media');
  const request = new Request('https://worker.example/upload', { method: 'POST', body: new Uint8Array([1,2,3,4]) });
  await import('node:assert').then(({ rejects }) => rejects(readLimitedBody(request, 3)));
});
test('receipt deletion can retry Cloudinary after Firestore has hidden the asset', async () => {
  const { deleteReceiptAsset } = await import('../src/media');
  const mediaEnv = { ...env, FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: 'unused' };
  const path = 'groups/g/expenses/e/attachments/a';
  let commits = 0;
  let pending = false;
  let failedOnce = false;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.endsWith(':commit')) {
      commits++;
      const write = JSON.parse(String(init?.body)).writes[0];
      strictEqual(write.update.fields.status.stringValue, 'deleted');
      strictEqual(write.update.fields.cleanupPending.booleanValue, true);
      pending = true;
      return Response.json({});
    }
    if (url.endsWith('/image/destroy')) {
      if (!failedOnce) { failedOnce = true; return Response.json({}, { status: 503 }); }
      return Response.json({ result: 'not found' });
    }
    if (url.includes('updateMask.fieldPaths=cleanupPending')) {
      strictEqual(init?.method, 'PATCH');
      strictEqual(JSON.parse(String(init?.body)).fields.cleanupPending.booleanValue, false);
      pending = false;
      return Response.json({});
    }
    throw new Error('Requête inattendue');
  };
  await rejects(deleteReceiptAsset(path, 'ourfinance-test/g/e/a', false, 'synthetic-token', mediaEnv, transport as typeof fetch));
  strictEqual(commits, 1);
  strictEqual(pending, true);
  await deleteReceiptAsset(path, 'ourfinance-test/g/e/a', true, 'synthetic-token', mediaEnv, transport as typeof fetch);
  strictEqual(commits, 1);
  strictEqual(pending, false);
});
