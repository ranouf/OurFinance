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
test('both exact TEST Hosting domains are allowed without accepting a lookalike origin', async () => {
  const secondary = 'https://ourfinance-test.firebaseapp.com';
  const configured = { ...env, ALLOWED_SECONDARY_ORIGIN: secondary };
  for (const origin of [env.ALLOWED_ORIGIN, secondary]) {
    const response = await handleRequest(new Request('https://worker.example/health', { headers: { Origin: origin } }), configured);
    strictEqual(response.status, 200);
    strictEqual(response.headers.get('Access-Control-Allow-Origin'), origin);
    const preflight = await handleRequest(new Request('https://worker.example/groups/g/expenses', { method: 'OPTIONS', headers: { Origin: origin } }), configured);
    strictEqual(preflight.status, 204);
    strictEqual(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  }
  const rejected = await handleRequest(new Request('https://worker.example/health', { headers: { Origin: `${secondary}.evil.example` } }), configured);
  strictEqual(rejected.status, 403);
  strictEqual(rejected.headers.get('Access-Control-Allow-Origin'), null);
});
test('group creation remains disabled by default even with server identity', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups', { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN } }), { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' });
  strictEqual(response.status, 503);
});
test('group lifecycle is disabled by default and scoped to one TEST group', async () => {
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured' };
  for (const path of ['/groups/g/archive', '/groups/g/members/member/revoke']) {
    strictEqual((await handleRequest(new Request('https://worker.example' + path, { method: 'POST' }), configured)).status, 503);
  }
  const enabled = { ...configured, ENABLE_GROUP_LIFECYCLE_POC: 'true', GROUP_LIFECYCLE_POC_GROUP_ID: 'g' };
  strictEqual((await handleRequest(new Request('https://worker.example/groups/other/archive', { method: 'POST' }), enabled)).status, 503);
  strictEqual((await handleRequest(new Request('https://worker.example/groups/g/archive', { method: 'POST' }), enabled)).status, 401);
});
test('receipt upload recovery remains disabled without an explicit test group', async () => {
  const configured = { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured', CLOUDINARY_CLOUD_NAME: 'configured', CLOUDINARY_API_KEY: 'configured', CLOUDINARY_API_SECRET: 'configured' };
  const response = await handleRequest(new Request('https://worker.example/groups/g/receipt-upload-jobs/cleanup', { method: 'POST' }), configured);
  strictEqual(response.status, 503);
  const enabled = { ...configured, ENABLE_MEDIA_POC: 'true', MEDIA_POC_GROUP_ID: 'g' };
  const unauthenticated = await handleRequest(new Request('https://worker.example/groups/g/receipt-upload-jobs/cleanup', { method: 'POST' }), enabled);
  strictEqual(unauthenticated.status, 401);
});
test('explicit V1 mode opens privileged routes for multiple groups but still requires identity', async () => {
  const configured = { ...env, ENABLE_API_V1: 'true', FIREBASE_SERVICE_ACCOUNT_JSON: 'configured',
    API_RATE_LIMITER: { limit: async () => ({ success: true }) },
    CLOUDINARY_CLOUD_NAME: 'configured', CLOUDINARY_API_KEY: 'configured', CLOUDINARY_API_SECRET: 'configured' };
  const routes: Array<[string, string]> = [
    ['GET', '/member-profiles'], ['GET', '/backup/restores/current'],
    ['GET', '/backup/restores/123e4567-e89b-42d3-a456-426614174000/outcome'], ['POST', '/backup/preview'],
    ['GET', '/backup/snapshot'], ['GET', '/backup/preferences'], ['POST', '/imports'],
    ['POST', '/settlements'], ['POST', '/categories'], ['POST', '/qr-invitations'],
    ['GET', '/qr-invitations'], ['POST', '/invitations'], ['POST', '/expenses'],
    ['PATCH', '/currency'], ['POST', '/archive'], ['POST', '/members/member/revoke'], ['POST', '/expenses/e/attachments'],
  ];
  for (const groupId of ['g1', 'g2']) {
    for (const [method, suffix] of routes) {
      const response = await handleRequest(new Request(`https://worker.example/groups/${groupId}${suffix}`, { method, headers: { 'CF-Connecting-IP': '203.0.113.10' } }), configured);
      strictEqual(response.status, 401, `${method} ${groupId}${suffix}`);
    }
  }
  strictEqual((await handleRequest(new Request('https://worker.example/groups', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' } }), configured)).status, 401);
  strictEqual((await handleRequest(new Request('https://worker.example/qr-invitations/preview', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' } }), configured)).status, 401);
});
test('V1 limits requests by connecting IP across groups without counting health or CORS preflight', async () => {
  const keys: string[] = [];
  const configured = { ...env, ENABLE_API_V1: 'true', API_RATE_LIMITER: {
    limit: async ({ key }: { key: string }) => { keys.push(key); return { success: keys.length < 2 }; },
  } };
  const request = (path: string) => new Request(`https://worker.example${path}`, { headers: { 'CF-Connecting-IP': '203.0.113.10' } });
  strictEqual((await handleRequest(request('/health'), configured)).status, 200);
  strictEqual((await handleRequest(new Request('https://worker.example/groups/g1/expenses', { method: 'OPTIONS', headers: { Origin: env.ALLOWED_ORIGIN } }), configured)).status, 204);
  strictEqual((await handleRequest(request('/groups/g1/access'), configured)).status, 401);
  const limited = await handleRequest(request('/groups/g2/access'), configured);
  strictEqual(limited.status, 429);
  strictEqual(limited.headers.get('Retry-After'), '60');
  strictEqual((await limited.json() as { error: string }).error, 'rate_limited');
  strictEqual(keys.join(','), '203.0.113.10,203.0.113.10');
});
test('V1 fails closed when rate limiting cannot be enforced', async () => {
  const request = (ip?: string) => new Request('https://worker.example/groups/g1/access', { headers: ip ? { 'CF-Connecting-IP': ip } : {} });
  strictEqual((await handleRequest(request('203.0.113.10'), { ...env, ENABLE_API_V1: 'true' })).status, 503);
  const configured = { ...env, ENABLE_API_V1: 'true', API_RATE_LIMITER: { limit: async () => ({ success: true }) } };
  strictEqual((await handleRequest(request(), configured)).status, 503);
  strictEqual((await handleRequest(request('bad address'), configured)).status, 503);
  strictEqual((await handleRequest(request('203.0.113.10'), { ...env, ENABLE_API_V1: 'true', API_RATE_LIMITER: { limit: async () => { throw new Error('provider down'); } } })).status, 503);
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
test('group metadata editing stays disabled without its own scoped TEST flag', async () => {
  const response = await handleRequest(new Request('https://worker.example/groups/g1/metadata', { method: 'PATCH' }),
    { ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'configured', ENABLE_GROUP_CURRENCY_POC: 'true', GROUP_CURRENCY_POC_GROUP_ID: 'g1' });
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
test('restore outcome is scoped to the configured group and requires authentication', async () => {
  const url = 'https://worker.example/groups/g1/backup/restores/123e4567-e89b-42d3-a456-426614174000/outcome';
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
