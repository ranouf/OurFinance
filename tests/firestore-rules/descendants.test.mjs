import { after, before, test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const projectId = 'ourfinance-descendants-test';
const root = `projects/${projectId}/databases/(default)/documents`;
const port = Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080);
const base = `http://127.0.0.1:${port}/v1/${root}`;
let environment;

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: {
    rules: "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{path=**} { allow read, write: if true; } } }",
    host: '127.0.0.1', port,
  } });
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const path of [
      'groups/g/expenses/e1/attachments/a1',
      'groups/g/expenses/e2/attachments/a2',
      'groups/g/expenses/e3/attachments/a3',
      'groups/other/expenses/e4/attachments/a4',
    ]) await setDoc(doc(db, path), { format: 'png' });
  });
});
after(async () => { await environment?.cleanup(); });

test('Firestore REST runQuery pages only descendant receipts of the selected group', async () => {
  const begin = await fetch(`${base}:beginTransaction`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options: { readOnly: {} } }) });
  strictEqual(begin.status, 200);
  const { transaction } = await begin.json();
  try {
    const read = async cursor => {
      const structuredQuery = { from: [{ collectionId: 'attachments', allDescendants: true }],
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 2,
        ...(cursor ? { startAt: { values: [{ referenceValue: cursor }], before: false } } : {}) };
      const response = await fetch(`${base}/groups/g:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery, transaction }) });
      strictEqual(response.status, 200);
      return (await response.json()).filter(row => row.document).map(row => row.document.name);
    };
    const first = await read();
    const second = await read(first.at(-1));
    deepStrictEqual([...first, ...second], [1, 2, 3].map(index => `${root}/groups/g/expenses/e${index}/attachments/a${index}`));
  } finally {
    await fetch(`${base}:rollback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction }) });
  }
});

test('cleanup marker conflicts with a transaction activating the same receipt', async () => {
  const journal = `${root}/groups/g/receiptUploadJobs/race`;
  const attachment = `${root}/groups/g/expenses/e1/attachments/race`;
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'groups/g/receiptUploadJobs/race'), { status: 'uploading', publicId: 'ourfinance-test/g/e1/race' });
  });
  const headers = { 'Content-Type': 'application/json' };
  const begin = await fetch(`${base}:beginTransaction`, { method: 'POST', headers, body: '{}' });
  strictEqual(begin.status, 200);
  const { transaction } = await begin.json();
  const read = await fetch(`${base}/groups/g/receiptUploadJobs/race?transaction=${encodeURIComponent(transaction)}`);
  strictEqual(read.status, 200);
  const marked = await fetch(`${base}/groups/g/receiptUploadJobs/race?updateMask.fieldPaths=status&currentDocument.exists=true`, {
    method: 'PATCH', headers, body: JSON.stringify({ fields: { status: { stringValue: 'cleanup_pending' } } }),
  });
  strictEqual(marked.status, 200);
  const commit = await fetch(`${base}:commit`, { method: 'POST', headers,
    body: JSON.stringify({ transaction, writes: [
      { update: { name: attachment, fields: { status: { stringValue: 'active' } } }, currentDocument: { exists: false } },
      { delete: journal, currentDocument: { exists: true } },
    ] }),
  });
  strictEqual(commit.ok, false);
  strictEqual((await fetch(`${base}/groups/g/expenses/e1/attachments/race`)).status, 404);
  const after = await fetch(`${base}/groups/g/receiptUploadJobs/race`);
  strictEqual(after.status, 200);
  strictEqual((await after.json()).fields.status.stringValue, 'cleanup_pending');
});
