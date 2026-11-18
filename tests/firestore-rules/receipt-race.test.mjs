import { after, before, test } from 'node:test';
import { strictEqual } from 'node:assert';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'ourfinance-receipt-race-test';
const root = `projects/${projectId}/databases/(default)/documents`;
const port = Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080);
const base = `http://127.0.0.1:${port}/v1/${root}`;
const headers = { 'Content-Type': 'application/json' };
let environment;

async function call(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method, headers, signal: AbortSignal.timeout(8_000), ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function begin() {
  const result = await call(':beginTransaction', 'POST', {});
  strictEqual(result.status, 200);
  return result.body.transaction;
}

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: {
    rules: "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{path=**} { allow read, write: if true; } } }",
    host: '127.0.0.1', port,
  } });
});
after(async () => { await environment?.cleanup(); });

for (const first of ['upload', 'delete']) test(`activation et suppression concurrentes : ${first} gagne, autre commit refusé`, async () => {
  const expenseId = first;
  const expensePath = `groups/race/expenses/${expenseId}`;
  const attachmentPath = `${expensePath}/attachments/a`;
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), expensePath), { deleted: false });
  });

  const upload = await begin();
  const deletion = await begin();
  for (const transaction of [upload, deletion]) {
    const read = await call(`/${expensePath}?transaction=${encodeURIComponent(transaction)}`);
    strictEqual(read.status, 200);
  }
  const listed = await call(`/${expensePath}/attachments?transaction=${encodeURIComponent(deletion)}`);
  strictEqual(listed.status, 200);
  strictEqual(listed.body.documents?.length ?? 0, 0);

  const expenseName = `${root}/${expensePath}`;
  const uploadWrites = [
    { update: { name: expenseName, fields: { receiptUpdatedAt: { timestampValue: new Date().toISOString() } } }, updateMask: { fieldPaths: ['receiptUpdatedAt'] } },
    { update: { name: `${root}/${attachmentPath}`, fields: { status: { stringValue: 'active' } } }, currentDocument: { exists: false } },
  ];
  const deleteWrites = [{ update: { name: expenseName, fields: { deleted: { booleanValue: true } } }, updateMask: { fieldPaths: ['deleted'] } }];
  const [winningTransaction, winningWrites, losingTransaction, losingWrites] = first === 'upload'
    ? [upload, uploadWrites, deletion, deleteWrites]
    : [deletion, deleteWrites, upload, uploadWrites];
  const winner = await call(':commit', 'POST', { transaction: winningTransaction, writes: winningWrites });
  const loser = await call(':commit', 'POST', { transaction: losingTransaction, writes: losingWrites });
  strictEqual(winner.status, 200, JSON.stringify(winner.body));
  strictEqual(loser.status === 200, false, JSON.stringify(loser.body));

  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const expense = await getDoc(doc(db, expensePath));
    const attachment = await getDoc(doc(db, attachmentPath));
    strictEqual(expense.data().deleted, first === 'delete');
    strictEqual(attachment.exists(), first === 'upload');
  });
});
