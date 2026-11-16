import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'ourfinance-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'groups/a'), { name: 'A' });
    await setDoc(doc(db, 'groups/b'), { name: 'B' });
    await setDoc(doc(db, 'groups/a/members/alice'), { role: 'owner', status: 'active' });
    await setDoc(doc(db, 'groups/a/members/bob'), { role: 'member', status: 'revoked' });
    await setDoc(doc(db, 'groups/a/expenses/e1'), { amountMinor: 100 });
    await setDoc(doc(db, 'groups/b/expenses/e2'), { amountMinor: 100 });
  });
});
after(async () => { await env?.cleanup(); });

test('active member reads only own group', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertSucceeds(getDoc(doc(db, 'groups/a/expenses/e1')));
  await assertFails(getDoc(doc(db, 'groups/b/expenses/e2')));
});

test('revoked and unauthenticated users cannot read', async () => {
  await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'groups/a/expenses/e1')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'groups/a/expenses/e1')));
});

test('client financial writes and collection group reads fail', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(db, 'groups/a/expenses/e3'), { amountMinor: 100 }));
  await assertFails(getDocs(collection(db, 'groups/b/expenses')));
});

test('profile cannot be read or changed by another user', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertFails(getDoc(doc(db, 'users/bob')));
  await assertFails(setDoc(doc(db, 'users/bob'), { displayName: 'X' }));
  await assertSucceeds(setDoc(doc(db, 'users/alice'), { displayName: 'A' }));
});
