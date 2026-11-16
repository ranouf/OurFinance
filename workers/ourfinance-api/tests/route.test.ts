import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { handleRequest } from '../src/index';
const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', ALLOWED_ORIGIN: 'https://ourfinance-test.web.app' };
test('health route uses no-store and CORS only for approved origin', async () => {
  const response = await handleRequest(new Request('https://worker.example/health', { headers: { Origin: env.ALLOWED_ORIGIN } }), env);
  strictEqual(response.status, 200);
  strictEqual(response.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGIN);
  strictEqual(response.headers.get('Cache-Control'), 'no-store');
});
test('unapproved origin and missing token are rejected', async () => {
  strictEqual((await handleRequest(new Request('https://worker.example/health', { headers: { Origin: 'https://evil.example' } }), env)).status, 403);
  strictEqual((await handleRequest(new Request('https://worker.example/groups/g/access'), env)).status, 401);
});
