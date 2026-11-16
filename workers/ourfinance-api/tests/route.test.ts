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
test('group creation remains disabled by default even with server identity', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups', { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN } }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('expense creation is disabled without an explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/expenses', { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN } }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('invitation creation and redemption are disabled without an explicit test group', async () => {
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' };
  for (const path of ['/groups/g1/invitations', '/groups/g1/invitations/i1/accept']) {
    const response = await handleRequest(new Request(`https://worker.example${path}`, { method: 'POST' }), configured);
    strictEqual(response.status, 503);
  }
});
