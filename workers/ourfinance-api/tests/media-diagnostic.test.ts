import { test } from 'node:test';
import { strictEqual, rejects } from 'node:assert';
import { fetchCloudinaryPrivate, MediaDiagnosticError } from '../src/media-diagnostic';
const signedUrl = new URL('https://api.cloudinary.com/v1_1/test/image/download?signature=private');
test('follows one HTTPS Cloudinary redirect without returning its URL', async () => {
  let calls = 0;
  const transport = async (_input: string | URL | Request) => {
    calls++;
    if (calls === 1) return new Response(null, { status: 302, headers: { Location: 'https://res.cloudinary.com/test/private' } });
    return new Response('image', { status: 200 });
  };
  const response = await fetchCloudinaryPrivate(signedUrl, transport as typeof fetch);
  strictEqual(response.status, 200);
  strictEqual(calls, 2);
});
test('rejects a redirect outside Cloudinary', async () => {
  const transport = async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example/collect' } });
  await rejects(fetchCloudinaryPrivate(signedUrl, transport as typeof fetch), (error: unknown) => error instanceof MediaDiagnosticError && error.code === 'download_redirect');
});
test('reports a fixed code if fetch throws', async () => {
  const transport = async () => { throw new Error('sensitive upstream details'); };
  await rejects(fetchCloudinaryPrivate(signedUrl, transport as typeof fetch), (error: unknown) => error instanceof MediaDiagnosticError && error.code === 'download_fetch');
});
