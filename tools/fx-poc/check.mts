/** Synthetic-only FX route check. Credentials and tokens remain in local memory. */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initializeApp, deleteApp, FirebaseError } = require('firebase/app') as typeof import('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth') as typeof import('firebase/auth');
const { doc, getDoc, getFirestore, setDoc } = require('firebase/firestore') as typeof import('firebase/firestore');

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variable de test absente : ${name}`);
  return value;
};
const projectId = required('TEST_FIREBASE_PROJECT_ID');
const workerUrl = new URL(required('TEST_WORKER_URL'));
const groupId = required('TEST_GROUP_ID');
const recipientId = required('TEST_RECIPIENT_UID');
const idempotencyKey = required('TEST_FX_ID');
if (projectId !== 'ourfinance-test' || workerUrl.protocol !== 'https:' || workerUrl.hostname !== 'ourfinance-api-dev.ur-inance.workers.dev' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(groupId) || !/^[A-Za-z0-9_-]{1,128}$/.test(recipientId) ||
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(idempotencyKey)) throw new Error('Cible de test non autorisée');

const app = initializeApp({ apiKey: required('TEST_FIREBASE_API_KEY'), authDomain: required('TEST_FIREBASE_AUTH_DOMAIN'),
  projectId, appId: required('TEST_FIREBASE_APP_ID') }, `fx-poc-${crypto.randomUUID()}`);
try {
  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(auth, required('TEST_MEMBER_EMAIL'), required('TEST_MEMBER_PASSWORD'));
  try {
    const user = credential.user;
    if (!user.emailVerified || user.uid === recipientId) throw new Error('Identité fictive invalide');
    const testDate = new Date().toISOString().slice(0, 10);
    const input = { idempotencyKey, date: testDate, debtCurrency: 'CAD', debtAmountMinor: 51,
      paymentCurrency: 'JPY', paymentAmountMinor: 1, rate: '2', rateDate: testDate, fromUserId: user.uid, toUserId: recipientId };
    const endpoint = new URL(`/groups/${groupId}/fx-settlements`, workerUrl);
    const post = async (body: object) => fetch(endpoint, { method: 'POST', headers: {
      Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify(body) });
    if (process.env.TEST_EXPECT_DENIED === 'true') {
      const response = await post(input);
      if (response.status !== 403) throw new Error(`Refus FX attendu, HTTP ${response.status}`);
      console.log('Écriture FX refusée comme attendu : 403');
    } else {
      const created = await post(input);
      if (created.status !== 201) throw new Error(`Création FX refusée, HTTP ${created.status}`);
      const repeated = await post(input);
      if (repeated.status !== 409) throw new Error(`Doublon FX non refusé, HTTP ${repeated.status}`);
      const invalid = await post({ ...input, idempotencyKey: crypto.randomUUID(), paymentAmountMinor: 2 });
      if (invalid.status !== 400) throw new Error(`Taux incohérent non refusé, HTTP ${invalid.status}`);
      const db = getFirestore(app);
      const settlement = await getDoc(doc(db, 'groups', groupId, 'fxSettlements', idempotencyKey));
      const activity = await getDoc(doc(db, 'groups', groupId, 'activity', `fx_settlement_${idempotencyKey}`));
      if (!settlement.exists() || !activity.exists() || settlement.data()['debtAmountMinor'] !== 51 ||
          settlement.data()['paymentAmountMinor'] !== 1 || settlement.data()['rate'] !== '2') throw new Error('Écriture FX incomplète');
      let denied = false;
      try { await setDoc(doc(db, 'groups', groupId, 'fxSettlements', crypto.randomUUID()), { debtAmountMinor: 1 }); }
      catch (error) { if (error instanceof FirebaseError && error.code === 'permission-denied') denied = true; else throw error; }
      if (!denied) throw new Error('Écriture Firestore cliente autorisée à tort');
      console.log('FX : création 201, doublon 409, taux invalide 400, opération et activité présentes, écriture cliente 403');
    }
  } finally { await signOut(auth); }
} finally { await deleteApp(app); }
