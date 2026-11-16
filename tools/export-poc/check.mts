/** Synthetic-only integration check. Credentials and file bytes stay in memory. */
import { FirebaseError, initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FirebaseExportReader } from '../../src/app/features/import-export/export-collector';
import { buildBackupPackageV1, verifyBackupPackageV1 } from '../../src/app/features/import-export/backup-package';
import { encodeBackupZipV1 } from '../../src/app/features/import-export/backup-zip';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variable de test absente : ${name}`);
  return value;
};
const projectId = required('TEST_FIREBASE_PROJECT_ID');
const workerUrl = new URL(required('TEST_WORKER_URL'));
const groupId = required('TEST_GROUP_ID');
if (projectId !== 'ourfinance-test' || workerUrl.protocol !== 'https:' || workerUrl.hostname !== 'ourfinance-api-dev.ur-inance.workers.dev' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(groupId)) throw new Error('Cible de test non autorisée');
const app = initializeApp({
  apiKey: required('TEST_FIREBASE_API_KEY'), authDomain: required('TEST_FIREBASE_AUTH_DOMAIN'),
  projectId, appId: required('TEST_FIREBASE_APP_ID'),
}, `export-poc-${crypto.randomUUID()}`);
try {
  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(auth, required('TEST_MEMBER_EMAIL'), required('TEST_MEMBER_PASSWORD'));
  try {
    const reader = new FirebaseExportReader(app);
    if (process.env.TEST_EXPECT_DENIED === 'true') {
      let denied = false;
      try { await buildBackupPackageV1(reader, credential.user, groupId, workerUrl.toString()); }
      catch (error) { if (error instanceof FirebaseError && error.code === 'permission-denied') denied = true; else throw error; }
      if (!denied) throw new Error('Export autorisé à tort');
      console.log('Export refusé comme attendu');
    } else {
      const backup = await buildBackupPackageV1(reader, credential.user, groupId, workerUrl.toString());
      await verifyBackupPackageV1(backup);
      const zip = await encodeBackupZipV1(backup);
      if (new DataView(zip.buffer).getUint32(0, true) !== 0x04034b50) throw new Error('ZIP invalide');
      console.log(`Groupe exporté : ${JSON.parse(backup.groupJson).group.id}`);
      console.log(`Dépenses : ${JSON.parse(backup.groupJson).expenses.length}`);
      console.log(`Reçus privés : ${backup.receipts.length}`);
      console.log(`ZIP en mémoire : ${zip.byteLength} octets, manifeste vérifié`);
      console.log(`Portée : ${backup.manifest.scope}`);
    }
  } finally { await signOut(auth); }
} finally { await deleteApp(app); }
