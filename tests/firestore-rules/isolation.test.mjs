import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, collectionGroup, getDocs, query, where } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'ourfinance-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080) },
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'groups/a'), { name: 'A', status: 'active' });
    await setDoc(doc(db, 'groups/b'), { name: 'B', status: 'active' });
    await setDoc(doc(db, 'groups/a/members/alice'), { role: 'owner', status: 'active' });
    await setDoc(doc(db, 'groups/a/members/bob'), { role: 'member', status: 'revoked' });
    await setDoc(doc(db, 'groups/a/expenses/e1'), { amountMinor: 100 });
    await setDoc(doc(db, 'groups/b/expenses/e2'), { amountMinor: 100 });
    await setDoc(doc(db, 'groups/a/expenses/e1/attachments/receipt'), { publicId: 'synthetic' });
    await setDoc(doc(db, 'groups/a/expenses/e1/comments/comment1'), { authorId: 'alice', text: 'Fictif' });
    await setDoc(doc(db, 'groups/a/activity/ev1'), { action: 'expense_created' });
    await setDoc(doc(db, 'groups/a/categories/custom_123e4567-e89b-42d3-a456-426614174000'), { name: 'Frais de chalet', status: 'active' });
    await setDoc(doc(db, 'users/alice/groupPreferences/a'), { modeJson: '{"kind":"equal","users":["alice"]}' });
    await setDoc(doc(db, 'users/alice/groupPreferences/b'), { modeJson: '{"kind":"equal","users":["alice"]}' });
    await setDoc(doc(db, 'users/alice/importBatches/b1'), { groupId: 'a', status: 'active' });
    await setDoc(doc(db, 'groups/a/importedRecords/r1'), { sourceId: 'synthetic', status: 'active' });
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

test('personal group references are private and client-writes denied', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/alice/groupMemberships/a'), { groupId: 'a' });
  });
  await assertSucceeds(getDoc(doc(alice, 'users/alice/groupMemberships/a')));
  await assertFails(getDoc(doc(bob, 'users/alice/groupMemberships/a')));
  await assertFails(setDoc(doc(alice, 'users/alice/groupMemberships/b'), { groupId: 'b' }));
});

test('profile cannot be read or changed by another user', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertFails(getDoc(doc(db, 'users/bob')));
  await assertFails(setDoc(doc(db, 'users/bob'), { displayName: 'X' }));
  const valid = { displayName: 'Alex Exemple', preferredLanguage: 'fr', timeZone: 'America/Toronto' };
  await assertSucceeds(setDoc(doc(db, 'users/alice'), valid));
  await assertSucceeds(getDoc(doc(db, 'users/alice')));
  await assertFails(setDoc(doc(db, 'users/alice'), { ...valid, role: 'owner' }));
  await assertFails(setDoc(doc(db, 'users/alice'), { ...valid, preferredLanguage: 'es' }));
  await assertFails(setDoc(doc(db, 'users/alice'), { ...valid, referenceCurrency: 'CAD' }));
  await assertFails(deleteDoc(doc(db, 'users/alice')));
});

test('a revoked member loses receipts, activity and personal preference', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  for (const path of ['groups/a/expenses/e1/attachments/receipt', 'groups/a/activity/ev1', 'users/alice/groupPreferences/a']) {
    await assertSucceeds(getDoc(doc(alice, path)));
    await assertFails(getDoc(doc(bob, path)));
  }
  await assertFails(getDoc(doc(alice, 'users/alice/groupPreferences/b')));
  await assertFails(setDoc(doc(alice, 'users/alice/groupPreferences/a'), { modeJson: 'forged' }));
});

test('commentaires lisibles uniquement par membre actif, écriture client interdite', async () => {
  const path = 'groups/a/expenses/e1/comments/comment1';
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(alice, path)));
  await assertFails(getDoc(doc(bob, path)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
  await assertFails(setDoc(doc(alice, 'groups/a/expenses/e1/comments/fake'), { text: 'Falsifié' }));
});

test('collection group queries cannot escape group isolation', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assertFails(getDocs(collectionGroup(alice, 'expenses')));
  await assertFails(getDocs(query(collectionGroup(alice, 'expenses'), where('amountMinor', '==', 100))));
});

test('client cannot forge membership or invitation', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(alice, 'groups/b/members/alice'), { role: 'owner', status: 'active' }));
  await assertFails(setDoc(doc(alice, 'groups/a/invitations/fake'), { token: 'fake' }));
  await assertFails(setDoc(doc(alice, 'groups/a/expenses/e1/attachments/fake'), { publicId: 'fake' }));
});

test('imported records and batch metadata follow active membership', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(alice, 'groups/a/importedRecords/r1')));
  await assertSucceeds(getDoc(doc(alice, 'users/alice/importBatches/b1')));
  await assertFails(getDoc(doc(bob, 'groups/a/importedRecords/r1')));
  await assertFails(getDoc(doc(bob, 'users/alice/importBatches/b1')));
  await assertFails(setDoc(doc(alice, 'groups/a/importedRecords/fake'), { sourceId: 'fake' }));
  await assertFails(setDoc(doc(alice, 'users/alice/importBatches/fake'), { groupId: 'a' }));
});

test('les catégories personnalisées sont lisibles uniquement par les membres actifs et non modifiables directement', async () => {
  const path = 'groups/a/categories/custom_123e4567-e89b-42d3-a456-426614174000';
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(alice, path)));
  await assertFails(getDoc(doc(bob, path)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
  await assertFails(setDoc(doc(alice, path), { name: 'Falsifiée' }));
});

test('un groupe en restauration bloque les lectures du membre avant réactivation', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const path = 'groups/a/expenses/e1';
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'groups/a'), { name: 'A', status: 'restoring' });
  });
  try {
    await assertFails(getDoc(doc(alice, path)));
    await assertFails(getDoc(doc(alice, 'users/alice/groupPreferences/a')));
  } finally {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'groups/a'), { name: 'A', status: 'active' });
    });
  }
  await assertSucceeds(getDoc(doc(alice, path)));
});
