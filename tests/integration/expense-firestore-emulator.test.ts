import { test } from 'node:test';
import { strictEqual, rejects } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createExpense, ExpenseError } from '../../workers/ourfinance-api/src/expenses';

const project = 'ourfinance-test';
const emulator = process.env['FIRESTORE_EMULATOR_HOST'];
const root = `projects/${project}/databases/(default)/documents`;
const base = `http://${emulator}/v1/${root}`;

test('transaction réelle : création, répétition identique et conflit de contenu', { skip: !emulator }, async () => {
  const groupId = `expense-integration-${crypto.randomUUID()}`;
  const expenseId = crypto.randomUUID();
  const fields = (values: Record<string, string>) => ({ fields: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: value }])) });
  const put = async (path: string, values: Record<string, string>) => {
    const response = await fetch(`${base}/${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify(fields(values)) });
    if (response.status !== 200) strictEqual(response.status, 200, `${path}: ${await response.text()}`);
  };
  const read = async (path: string) => {
    const response = await fetch(`${base}/${path}`, { headers: { Authorization: 'Bearer owner' } });
    if (response.status !== 200) strictEqual(response.status, 200, `${path}: ${await response.text()}`);
    return await response.json() as { fields: Record<string, { stringValue?: string; integerValue?: string }> };
  };
  await put(`groups/${groupId}`, { name: 'Groupe fictif', currencyCode: 'CAD', status: 'active', ownerId: 'alice' });
  await put(`groups/${groupId}/members/alice`, { status: 'active', role: 'owner' });
  await put(`groups/${groupId}/members/bob`, { status: 'active', role: 'member' });
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: project, FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: project, client_email: `integration@${project}.iam.gserviceaccount.com`, private_key: await exportPKCS8(privateKey) }) };
  const transport: typeof fetch = (async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'emulator-only' });
    if (!url.startsWith('https://firestore.googleapis.com/v1/')) throw new Error(`Unexpected provider: ${url}`);
    return fetch(url.replace('https://firestore.googleapis.com/v1/', `http://${emulator}/v1/`), { ...init, headers: { ...init?.headers, Authorization: 'Bearer owner' } });
  }) as typeof fetch;
  const input = { idempotencyKey: expenseId, description: 'Repas fictif', categoryId: 'restaurant', currency: 'CAD', date: '2026-11-27', amountMinor: 101,
    payments: [{ userId: 'alice', amountMinor: 101 }], splitMode: { kind: 'equal' as const, users: ['alice', 'bob'] } };
  strictEqual(await createExpense(input, 'alice', groupId, env, transport), expenseId);
  strictEqual(await createExpense(input, 'alice', groupId, env, transport), expenseId);
  await rejects(createExpense({ ...input, description: 'Autre repas fictif' }, 'alice', groupId, env, transport),
    (error: unknown) => error instanceof ExpenseError && error.status === 409 && error.code === 'idempotency_conflict');
  const stored = await read(`groups/${groupId}/expenses/${expenseId}`);
  strictEqual(stored.fields['amountMinor']?.integerValue, '101');
  strictEqual(stored.fields['description']?.stringValue, input.description);
  strictEqual((await read(`users/alice/groupPreferences/${groupId}`)).fields['modeJson']?.stringValue, JSON.stringify(input.splitMode));
  strictEqual((await read(`groups/${groupId}/activity/${expenseId}`)).fields['action']?.stringValue, 'expense_created');
});
