import { after, test } from 'node:test';
import { strictEqual, rejects } from 'node:assert';
import { createHash } from 'node:crypto';
import { exportPKCS8, generateKeyPair } from 'jose';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createImportBatch, ImportError, undoImportBatch } from '../../workers/ourfinance-api/src/import-batches.ts';

const projectId = 'ourfinance-native-import-test';
const port = Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080);
const root = `projects/${projectId}/databases/(default)/documents`;
const base = `http://127.0.0.1:${port}/v1/${root}`;
const headers = { 'Content-Type': 'application/json' };
let environment;
after(async () => { await environment?.cleanup(); });

async function seed(path, fields) {
  const response = await fetch(`${base}/${path}`, { method: 'PATCH', headers, body: JSON.stringify({ fields }) });
  strictEqual(response.status, 200);
}

/** The emulator's document GET hangs with a transaction token; batchGet uses that same token. */
async function emulatorTransport(resource, options) {
  const original = String(resource);
  if (original.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-access' });
  const url = new URL(original.replace('https://firestore.googleapis.com/v1', `http://127.0.0.1:${port}/v1`));
  if ((options?.method ?? 'GET') === 'GET' && url.searchParams.has('transaction')) {
    const response = await fetch(`${base}:batchGet`, { method: 'POST', headers, body: JSON.stringify({
      documents: [url.pathname.slice('/v1/'.length)], transaction: url.searchParams.get('transaction'),
    }) });
    if (!response.ok) return response;
    const records = await response.json();
    return records[0]?.found ? Response.json(records[0].found) : new Response(null, { status: 404 });
  }
  const forwarded = new Headers(options?.headers);
  forwarded.delete('Authorization'); // Authentication is synthetic; only this emulator project has permissive rules.
  return fetch(url, { ...options, headers: forwarded });
}

test('native source remains reserved after an emulated Firestore commit and undo', async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: {
    rules: "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{path=**} { allow read, write: if true; } } }",
    host: '127.0.0.1', port,
  } });
  const string = value => ({ stringValue: value });
  await seed('groups/synthetic-group', { status: string('active'), currencyCode: string('JPY') });
  await seed('groups/synthetic-group/members/alex', { status: string('active'), role: string('owner') });
  await seed('groups/synthetic-group/members/camille', { status: string('active'), role: string('member') });
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: projectId, FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: projectId, client_email: `fixture@${projectId}.iam.gserviceaccount.com`, private_key: await exportPKCS8(privateKey),
  }) };
  const sourceId = `native_${createHash('sha256').update(JSON.stringify([
    '2026-11-01', 'Trajet fictif', 'Transport', 'JPY', '101.5', 0,
  ])).digest('hex')}`;
  const row = { sourceId, date: '2026-11-01', description: 'Trajet fictif', currency: 'JPY',
    sourceCategory: 'Transport', sourceOccurrence: 0, sourceCostExact: '101.50', sourcePrecision: 2,
    netImpactsExact: { alex: '50.75', camille: '-50.75' } };
  const batchId = '123e4567-e89b-42d3-a456-426614174011';
  strictEqual((await createImportBatch({ batchId, records: [row] }, 'alex', 'synthetic-group', env, emulatorTransport)).recordCount, 1);
  const retry = id => createImportBatch({ batchId: id, records: [row] }, 'alex', 'synthetic-group', env, emulatorTransport);
  await rejects(retry('123e4567-e89b-42d3-a456-426614174012'), error => error instanceof ImportError && error.status === 409);
  await undoImportBatch(batchId, 'alex', 'synthetic-group', env, emulatorTransport);
  await rejects(retry('123e4567-e89b-42d3-a456-426614174013'), error => error instanceof ImportError && error.status === 409);
  const record = await fetch(`${base}/groups/synthetic-group/importedRecords/${createHash('sha256').update(sourceId).digest('hex')}`);
  strictEqual(record.status, 200);
  strictEqual((await record.json()).fields.status.stringValue, 'undone');
});
