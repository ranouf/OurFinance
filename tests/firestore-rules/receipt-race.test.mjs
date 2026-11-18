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

for (const first of ['upload', 'delete']) test(`activation et suppression concurrentes : ${first} gagne sans pièce active orpheline`, async () => {
  const expenseId = first;
  const expensePath = `groups/race/expenses/${expenseId}`;
  const attachmentPath = `${expensePath}/attachments/a`;
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), expensePath), { deleted: false });
  });

  const upload = await begin();
  const deletion = await begin();
  const winningTransaction = first === 'upload' ? upload : deletion;
  const losingTransaction = first === 'upload' ? deletion : upload;
  const winningRead = await call(`/${expensePath}?transaction=${encodeURIComponent(winningTransaction)}`);
  strictEqual(winningRead.status, 200);

  const expenseName = `${root}/${expensePath}`;
  const uploadWrites = [
    { update: { name: expenseName, fields: { receiptUpdatedAt: { timestampValue: new Date().toISOString() } } }, updateMask: { fieldPaths: ['receiptUpdatedAt'] } },
    { update: { name: `${root}/${attachmentPath}`, fields: { status: { stringValue: 'active' } } }, currentDocument: { exists: false } },
  ];
  const deleteWrites = [{ update: { name: expenseName, fields: { deleted: { booleanValue: true } } }, updateMask: { fieldPaths: ['deleted'] } }];
  // Firestore may block the second read until the first transaction commits.
  // Starting it before the commit still exercises both possible orderings.
  const losingReadPromise = call(`/${expensePath}?transaction=${encodeURIComponent(losingTransaction)}`);
  const winningWrites = first === 'upload' ? uploadWrites : deleteWrites;
  const winner = await call(':commit', 'POST', { transaction: winningTransaction, writes: winningWrites });
  strictEqual(winner.status, 200, JSON.stringify(winner.body));
  const losingRead = await losingReadPromise;
  if (losingRead.status === 200) {
    if (first === 'upload') {
      const listed = await call(`/${expensePath}/attachments?transaction=${encodeURIComponent(deletion)}`);
      if (listed.status === 200) {
        const visibleAttachment = (listed.body.documents ?? []).some(row => row.name === `${root}/${attachmentPath}`);
        const writes = [...deleteWrites, ...(visibleAttachment ? [{ update: { name: `${root}/${attachmentPath}`, fields: { status: { stringValue: 'deleted' } } }, updateMask: { fieldPaths: ['status'] } }] : [])];
        await call(':commit', 'POST', { transaction: deletion, writes });
      }
    } else if (losingRead.body.fields?.deleted?.booleanValue !== true) {
      const staleUpload = await call(':commit', 'POST', { transaction: upload, writes: uploadWrites });
      strictEqual(staleUpload.status === 200, false, JSON.stringify(staleUpload.body));
    }
  }
  await call(':rollback', 'POST', { transaction: losingTransaction });

  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const expense = await getDoc(doc(db, expensePath));
    const attachment = await getDoc(doc(db, attachmentPath));
    strictEqual(expense.data().deleted === true && attachment.exists() && attachment.data().status === 'active', false);
    if (first === 'delete') {
      strictEqual(expense.data().deleted, true);
      strictEqual(attachment.exists(), false);
    } else {
      strictEqual(attachment.exists(), true);
    }
  });
});
