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
test('one configured preview origin is allowed without widening the main origin', async () => {
  const preview = 'https://ourfinance-test--csp-121-b8lgwqgm.web.app';
  const configured = { ...env, ALLOWED_PREVIEW_ORIGIN: preview };
  for (const origin of [env.ALLOWED_ORIGIN, preview]) {
    const response = await handleRequest(new Request('https://worker.example/health', { headers: { Origin: origin } }), configured);
    strictEqual(response.status, 200);
    strictEqual(response.headers.get('Access-Control-Allow-Origin'), origin);
  }
  const rejected = await handleRequest(new Request('https://worker.example/health', { headers: { Origin: `${preview}.evil.example` } }), configured);
  strictEqual(rejected.status, 403);
  strictEqual(rejected.headers.get('Access-Control-Allow-Origin'), null);
});
test('group creation remains disabled by default even with server identity', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups', { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN } }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('explicit V1 mode opens privileged routes for multiple groups but still requires identity', async () => {
  const configured = { ...env, ENABLE_API_V1: 'true', FIREBASE_SERVICE_ACCOUNT_JSON: 'configured',
    CLOUDINARY_CLOUD_NAME: 'configured', CLOUDINARY_API_KEY: 'configured', CLOUDINARY_API_SECRET: 'configured' };
  const routes: Array<[string, string]> = [
    ['GET', '/member-profiles'], ['GET', '/backup/restores/current'], ['POST', '/backup/preview'],
    ['GET', '/backup/snapshot'], ['GET', '/backup/preferences'], ['POST', '/imports'],
    ['POST', '/settlements'], ['POST', '/categories'], ['POST', '/qr-invitations'],
    ['GET', '/qr-invitations'], ['POST', '/invitations'], ['POST', '/expenses'],
    ['PATCH', '/currency'], ['POST', '/expenses/e/attachments'],
  ];
  for (const groupId of ['g1', 'g2']) {
    for (const [method, suffix] of routes) {
      const response = await handleRequest(new Request(`https://worker.example/groups/${groupId}${suffix}`, { method }), configured);
      strictEqual(response.status, 401, `${method} ${groupId}${suffix}`);
    }
  }
  strictEqual((await handleRequest(new Request('https://worker.example/groups', { method: 'POST' }), configured)).status, 401);
  strictEqual((await handleRequest(new Request('https://worker.example/qr-invitations/preview', { method: 'POST' }), configured)).status, 401);
});
test('legacy one-group switch remains scoped when V1 mode is absent', async () => {
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured', ENABLE_EXPENSE_POC: 'true', EXPENSE_POC_GROUP_ID: 'g1' };
  const forGroup = (groupId: string) => handleRequest(new Request(`https://worker.example/groups/${groupId}/expenses`, { method: 'POST' }), configured);
  strictEqual((await forGroup('g1')).status, 401);
  strictEqual((await forGroup('g2')).status, 503);
});
test('group currency change remains disabled without one explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/currency', { method: 'PATCH' }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('backup preferences remain disabled without one explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/backup/preferences'), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('transactional backup snapshot remains disabled without one explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/backup/snapshot'), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('restoration and cleanup remain disabled without one explicit test group', async () => {
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured', CLOUDINARY_CLOUD_NAME: 'configured', CLOUDINARY_API_KEY: 'configured', CLOUDINARY_API_SECRET: 'configured' };
  const id = '123e4567-e89b-42d3-a456-426614174000';
  for (const [method, path] of [['POST', `/groups/g1/backup/restores/${id}`], ['DELETE', `/groups/g1/backup/restores/${id}`],
    ['POST', `/groups/g1/backup/restores/${id}/cleanup`], ['POST', `/groups/g1/backup/restores/${id}/prepare`],
    ['POST', `/groups/g1/backup/restores/${id}/receipts/0`], ['POST', `/groups/g1/backup/restores/${id}/commit`]]) {
    const response = await handleRequest(new Request(`https://worker.example${path}`, { method }), configured);
    strictEqual(response.status, 503);
  }
});
test('restore preview remains disabled without one explicit test group', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/backup/preview', { method: 'POST' }),
    { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('restore recovery state is disabled by default and requires authentication when enabled', async () => {
  const url = 'https://worker.example/groups/g1/backup/restores/current';
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' };
  strictEqual((await handleRequest(new Request(url), configured)).status, 503);
  strictEqual((await handleRequest(new Request(url), { ...configured, ENABLE_RESTORE_POC: 'true', RESTORE_POC_GROUP_ID: 'other' })).status, 503);
  strictEqual((await handleRequest(new Request(url), { ...configured, ENABLE_RESTORE_POC: 'true', RESTORE_POC_GROUP_ID: 'g1' })).status, 401);
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
