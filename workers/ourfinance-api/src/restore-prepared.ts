import { sha256Hex } from '../../../src/app/features/import-export/backup-package';
import { verifyBackupPackageV2, type BackupPackageV2 } from '../../../src/app/features/import-export/backup-package-v2';
import type { GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { imageFormat, uploadAuthenticated, type CloudinaryEnv } from './cloudinary';
import { unavailableCode } from './provider-quota';
import { beginPreparedRestoreLock } from './restore-lock';
import { collectLiveRestoreInventory } from './restore-inventory';
import { commitGroupRestoreV2, readRestoreOutcome } from './restore-commit';
import type { LiveRestoreInventory } from './restore-inventory';
import type { StagedRestoreReceipt } from './restore-media';
import { serviceAccessToken } from './service-account';

export interface PreparedRestoreEnv extends CloudinaryEnv {
  readonly FIREBASE_PROJECT_ID: string;
  readonly FIREBASE_SERVICE_ACCOUNT_JSON: string;
}
export class PreparedRestoreError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
interface FirestoreValue {
  readonly stringValue?: string;
  readonly arrayValue?: { readonly values?: readonly { readonly stringValue?: string }[] };
}
interface FirestoreDocument {
  readonly updateTime?: string;
  readonly fields?: Record<string, FirestoreValue>;
}
export interface PreparedRestoreJob {
  readonly manifestSha256: string;
  readonly publicIds: readonly string[];
  readonly receiptSha256: readonly string[];
  readonly receiptFormats: readonly ('jpg' | 'png')[];
  readonly stagedIndices: readonly number[];
  readonly updateTime: string;
}
export interface PreparedRestoreResult { readonly restoreId: string; readonly cleanupPending: boolean }
export interface PreparedCommitOperations {
  inventory(uid: string, groupId: string, restoreId: string): Promise<LiveRestoreInventory>;
  commit(uid: string, groupId: string, restoreId: string, backup: GroupExportV2, live: LiveRestoreInventory,
    staged: readonly StagedRestoreReceipt[]): Promise<readonly string[]>;
  outcome(uid: string, groupId: string, restoreId: string): Promise<'committed' | 'locked'>;
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shaPattern = /^[0-9a-f]{64}$/;

async function verifiedArchive(groupId: string, restoreId: string, archive: BackupPackageV2, projectId: string) {
  try { await verifyBackupPackageV2(archive); }
  catch { throw new PreparedRestoreError(400, 'invalid_backup'); }
  const backup = JSON.parse(archive.groupJson) as GroupExportV2;
  if (backup.group.id !== groupId || backup.snapshotMode !== 'server_transaction' || archive.receipts.length > 100) {
    throw new PreparedRestoreError(400, 'invalid_backup');
  }
  const manifestSha256 = await sha256Hex(new TextEncoder().encode(JSON.stringify(archive.manifest)));
  const publicIds = archive.manifest.receipts.map(row => `${projectId}/${groupId}/${row.expenseId}/restore_${restoreId}/${row.attachmentId}`);
  const receiptSha256 = archive.manifest.receipts.map(row => row.sha256);
  const receiptFormats = archive.manifest.receipts.map(row => row.contentType === 'image/png' ? 'png' as const : 'jpg' as const);
  return { backup, manifestSha256, publicIds, receiptSha256, receiptFormats };
}

/** Start a resumable restore without uploading any media in the lock invocation. */
export async function prepareRestore(uid: string, groupId: string, restoreId: string, archive: BackupPackageV2,
  env: PreparedRestoreEnv, transport: typeof fetch = fetch): Promise<{ restoreId: string; expectedReceipts: number }> {
  const checked = await verifiedArchive(groupId, restoreId, archive, env.FIREBASE_PROJECT_ID);
  try {
    await beginPreparedRestoreLock(uid, groupId, restoreId, checked.backup.group.currency, checked.publicIds,
      { manifestSha256: checked.manifestSha256, receiptSha256: checked.receiptSha256, receiptFormats: checked.receiptFormats }, env, transport);
  } catch (error) {
    // A lost lock response is safe to replay only for the same owner and exact archive.
    let job: PreparedRestoreJob;
    try { job = await readPreparedRestoreJob(uid, groupId, restoreId, env, transport); }
    catch { throw error; }
    if (job.manifestSha256 !== checked.manifestSha256 || job.publicIds.length !== checked.publicIds.length ||
        job.publicIds.some((value, index) => value !== checked.publicIds[index] ||
          job.receiptSha256[index] !== checked.receiptSha256[index] || job.receiptFormats[index] !== checked.receiptFormats[index])) throw error;
  }
  return { restoreId, expectedReceipts: checked.publicIds.length };
}

/** Recheck the owner, active membership, lock and job for every staged media request. */
export async function readPreparedRestoreJob(uid: string, groupId: string, restoreId: string,
  env: PreparedRestoreEnv, transport: typeof fetch = fetch): Promise<PreparedRestoreJob> {
  if (![uid, groupId].every(id => idPattern.test(id)) || !uuidPattern.test(restoreId)) throw new PreparedRestoreError(400, 'invalid_restore');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}` };
  const read = async (path: string, missingStatus: 403 | 409 = 409): Promise<FirestoreDocument> => {
    const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}`, { headers });
    if (!response.ok) throw new PreparedRestoreError(response.status === 404 ? missingStatus : 503,
      response.status === 404 && missingStatus === 403 ? 'owner_required' : unavailableCode(response, 'restore_unavailable'));
    return await response.json() as FirestoreDocument;
  };
  const [group, member, job] = await Promise.all([
    read(`groups/${groupId}`), read(`groups/${groupId}/members/${uid}`, 403), read(`groups/${groupId}/restoreJobs/${restoreId}`),
  ]);
  const gf = group.fields, mf = member.fields, jf = job.fields;
  if (gf?.['ownerId']?.stringValue !== uid || mf?.['role']?.stringValue !== 'owner' || mf['status']?.stringValue !== 'active') {
    throw new PreparedRestoreError(403, 'owner_required');
  }
  if (gf['status']?.stringValue !== 'restoring' || gf['restoreId']?.stringValue !== restoreId ||
      gf['restoreOwnerId']?.stringValue !== uid || jf?.['ownerId']?.stringValue !== uid || jf['status']?.stringValue !== 'staging') {
    throw new PreparedRestoreError(409, 'restore_state_changed');
  }
  const strings = (value: FirestoreValue | undefined) => value?.arrayValue?.values?.map(item => item.stringValue) ?? [];
  const ids = strings(jf['newPublicIds']);
  const digests = strings(jf['receiptSha256']);
  const formats = strings(jf['receiptFormats']);
  const stages = strings(jf['stagedIndices']);
  const expected = new RegExp(`^${env.FIREBASE_PROJECT_ID}/${groupId}/[A-Za-z0-9_-]{1,128}/restore_${restoreId}/[A-Za-z0-9_-]{1,128}$`, 'i');
  if (!shaPattern.test(jf['manifestSha256']?.stringValue ?? '') || !job.updateTime || ids.length > 100 ||
      ids.length !== digests.length || ids.length !== formats.length || new Set(ids).size !== ids.length ||
      ids.some(id => typeof id !== 'string' || !expected.test(id)) ||
      digests.some(value => typeof value !== 'string' || !shaPattern.test(value)) ||
      formats.some(value => value !== 'jpg' && value !== 'png') ||
      stages.some(value => typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value) || Number(value) >= ids.length) ||
      new Set(stages).size !== stages.length) throw new PreparedRestoreError(503, 'invalid_restore_job');
  return { manifestSha256: jf['manifestSha256'].stringValue!, publicIds: ids as string[], receiptSha256: digests as string[],
    receiptFormats: formats as ('jpg' | 'png')[],
    stagedIndices: stages.map(Number), updateTime: job.updateTime };
}

/** One exact receipt per invocation keeps Cloudinary and Firestore below the Free subrequest ceiling. */
export async function stagePreparedRestoreReceipt(uid: string, groupId: string, restoreId: string, index: number,
  bytes: Uint8Array, format: 'jpg' | 'png', env: PreparedRestoreEnv, transport: typeof fetch = fetch): Promise<{ staged: boolean }> {
  if (!Number.isSafeInteger(index) || index < 0 || bytes.byteLength > 2_000_000) throw new PreparedRestoreError(400, 'invalid_media');
  try { if (imageFormat(bytes, format === 'png' ? 'image/png' : 'image/jpeg') !== format) throw new Error('format'); }
  catch { throw new PreparedRestoreError(400, 'invalid_media'); }
  const job = await readPreparedRestoreJob(uid, groupId, restoreId, env, transport);
  if (index >= job.publicIds.length) throw new PreparedRestoreError(400, 'invalid_media');
  if (format !== job.receiptFormats[index]) throw new PreparedRestoreError(400, 'invalid_media');
  if (await sha256Hex(bytes) !== job.receiptSha256[index]) throw new PreparedRestoreError(400, 'invalid_media');
  if (job.stagedIndices.includes(index)) return { staged: false };
  // A lost Firestore response can require the same exact bytes to be uploaded again.
  await uploadAuthenticated(bytes, format, job.publicIds[index], env, transport, true);
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const url = new URL(`https://firestore.googleapis.com/v1/${root}/groups/${groupId}/restoreJobs/${restoreId}`);
  url.searchParams.set('updateMask.fieldPaths', 'stagedIndices');
  url.searchParams.set('currentDocument.updateTime', job.updateTime);
  const response = await transport(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { stagedIndices: { arrayValue: { values: [...job.stagedIndices, index].sort((a, b) => a - b).map(value => ({ stringValue: String(value) })) } } } }) });
  if (!response.ok) throw new PreparedRestoreError(response.status === 409 || response.status === 412 ? 409 : 503, unavailableCode(response, 'stage_unavailable'));
  return { staged: true };
}

/** The document swap remains atomic; only previously verified, staged media can enter it. */
export async function commitPreparedRestore(uid: string, groupId: string, restoreId: string, archive: BackupPackageV2,
  env: PreparedRestoreEnv, transport: typeof fetch = fetch, override?: PreparedCommitOperations): Promise<PreparedRestoreResult> {
  const operations: PreparedCommitOperations = override ?? {
    inventory: (user, group, id) => collectLiveRestoreInventory(user, group, env, transport, id),
    commit: (user, group, id, backup, live, staged) => commitGroupRestoreV2(user, group, id, backup, live, staged, env, transport),
    outcome: (user, group, id) => readRestoreOutcome(user, group, id, env, transport),
  };
  const checked = await verifiedArchive(groupId, restoreId, archive, env.FIREBASE_PROJECT_ID);
  let job: PreparedRestoreJob;
  try { job = await readPreparedRestoreJob(uid, groupId, restoreId, env, transport); }
  catch (error) {
    // A committed swap may have lost its HTTP response. The durable marker resolves it.
    if (error instanceof PreparedRestoreError && error.status === 409 &&
        await operations.outcome(uid, groupId, restoreId) === 'committed') {
      return { restoreId, cleanupPending: true };
    }
    throw error;
  }
  if (job.manifestSha256 !== checked.manifestSha256 || job.publicIds.length !== checked.publicIds.length ||
      job.publicIds.some((value, index) => value !== checked.publicIds[index] || job.receiptSha256[index] !== checked.receiptSha256[index] ||
        job.receiptFormats[index] !== checked.receiptFormats[index]) ||
      job.stagedIndices.length !== job.publicIds.length || job.stagedIndices.some((value, index) => value !== index)) {
    throw new PreparedRestoreError(409, 'receipts_not_staged');
  }
  const staged = archive.manifest.receipts.map((row, index) => ({ expenseId: row.expenseId, attachmentId: row.attachmentId,
    publicId: job.publicIds[index], format: row.contentType === 'image/png' ? 'png' as const : 'jpg' as const }));
  const live = await operations.inventory(uid, groupId, restoreId);
  try { await operations.commit(uid, groupId, restoreId, checked.backup, live, staged); }
  catch (error) {
    try {
      if (await operations.outcome(uid, groupId, restoreId) !== 'committed') throw new PreparedRestoreError(409, 'restore_not_committed');
    } catch (outcomeError) {
      if (outcomeError instanceof PreparedRestoreError) throw outcomeError;
      throw new PreparedRestoreError(503, 'recovery_required');
    }
    void error;
  }
  // Cleanup uses separate bounded requests; never add media deletion to this commit invocation.
  return { restoreId, cleanupPending: true };
}
