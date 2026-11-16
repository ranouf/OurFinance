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
test('group currency change remains disabled without one explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/currency', { method: 'PATCH' }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('backup preferences remain disabled without one explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/backup/preferences'), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('expense creation is disabled without an explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/expenses', { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN } }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('comment creation is disabled without an explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/expenses/e1/comments', { method: 'POST' }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('invitation creation and redemption are disabled without an explicit test group', async () => {
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' };
  for (const path of ['/groups/g1/invitations', '/groups/g1/invitations/i1/accept']) {
    const response = await handleRequest(new Request(`https://worker.example${path}`, { method: 'POST' }), configured);
    strictEqual(response.status, 503);
  }
});
test('settlement creation is disabled without an explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/settlements', { method: 'POST' }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('import and undo are disabled without an explicit test group', async () => {
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' };
  for (const [method, path] of [['POST', '/groups/g1/imports'], ['DELETE', '/groups/g1/imports/b1']]) {
    const response = await handleRequest(new Request(`https://worker.example${path}`, { method }), configured);
    strictEqual(response.status, 503);
  }
});
test('custom categories stay disabled without an explicit test group', async () => {
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' };
  for (const [method, path] of [['POST', '/groups/g1/categories'], ['PATCH', '/groups/g1/categories/custom_123e4567-e89b-42d3-a456-426614174000']]) {
    const response = await handleRequest(new Request(`https://worker.example${path}`, { method }), configured);
    strictEqual(response.status, 503);
  }
  const preflight = await handleRequest(new Request('https://worker.example/groups/g1/categories', { method: 'OPTIONS', headers: { Origin: env.ALLOWED_ORIGIN } }), configured);
  strictEqual(preflight.headers.get('Access-Control-Allow-Methods')?.includes('PATCH'), true);
});
