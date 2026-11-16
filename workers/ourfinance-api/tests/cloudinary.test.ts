import { test } from 'node:test';
import { strictEqual, throws } from 'node:assert';
import { createHash } from 'node:crypto';
import { authenticatedDownloadUrl, imageFormat, signCloudinary, uploadAuthenticated } from '../src/cloudinary';
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
    return Response.json({ public_id: 'ourfinance-test/g/e/a', type: 'authenticated', resource_type: 'image', format: 'png' });
  };
  await uploadAuthenticated(png, 'png', 'ourfinance-test/g/e/a', env, transport as typeof fetch);
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
