import { verifyBackupPackageV2, type BackupPackageV2 } from '../../../src/app/features/import-export/backup-package-v2';
import type { GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { beginRestoreLock, abortRestoreLock } from './restore-lock';
import { collectLiveRestoreInventory, type LiveRestoreInventory } from './restore-inventory';
import { stageRestoreReceipts, type RestoreReceiptBytes, type StagedRestoreReceipt } from './restore-media';
import { commitGroupRestoreV2, readRestoreOutcome } from './restore-commit';
import { retryRestoreCleanup } from './restore-cleanup';

export interface RestoreEnv {
  readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string;
  readonly CLOUDINARY_CLOUD_NAME: string; readonly CLOUDINARY_API_KEY: string; readonly CLOUDINARY_API_SECRET: string;
}
export interface RestoreResult { readonly restoreId: string; readonly cleanupPending: boolean }
export class RestoreOrchestrationError extends Error {
  constructor(readonly code: 'recovery_required' | 'invalid_backup', options?: ErrorOptions) { super(code, options); }
}

export interface RestoreOperations {
  begin(uid: string, groupId: string, restoreId: string, currency: string, publicIds: readonly string[]): Promise<void>;
  abort(uid: string, groupId: string, restoreId: string): Promise<void>;
  stage(groupId: string, restoreId: string, receipts: readonly RestoreReceiptBytes[]): Promise<StagedRestoreReceipt[]>;
  inventory(uid: string, groupId: string, restoreId: string): Promise<LiveRestoreInventory>;
  commit(uid: string, groupId: string, restoreId: string, backup: GroupExportV2, live: LiveRestoreInventory, staged: readonly StagedRestoreReceipt[]): Promise<readonly string[]>;
  outcome(uid: string, groupId: string, restoreId: string): Promise<'committed' | 'locked'>;
  cleanup(uid: string, groupId: string, restoreId: string): Promise<number>;
}

/** The archive is verified before a lock; a failed swap keeps the old group until abort. */
export async function restoreGroupFromPackage(
  uid: string, groupId: string, restoreId: string, archive: BackupPackageV2, env: RestoreEnv,
  transport: typeof fetch = fetch, override?: RestoreOperations,
): Promise<RestoreResult> {
  try { await verifyBackupPackageV2(archive); }
  catch (error) { throw new RestoreOrchestrationError('invalid_backup', { cause: error }); }
  const backup = JSON.parse(archive.groupJson) as GroupExportV2;
  if (backup.group.id !== groupId || backup.snapshotMode !== 'server_transaction') throw new RestoreOrchestrationError('invalid_backup');
  const receipts = archive.receipts.map((item, index) => ({
    expenseId: archive.manifest.receipts[index].expenseId, attachmentId: archive.manifest.receipts[index].attachmentId,
    format: item.contentType === 'image/png' ? 'png' as const : 'jpg' as const, bytes: item.bytes,
  }));
  const expectedPublicIds = receipts.map(row => `ourfinance-test/${groupId}/${row.expenseId}/restore_${restoreId}/${row.attachmentId}`);
  const operations: RestoreOperations = override ?? {
    begin: (user, group, id, currency, ids) => beginRestoreLock(user, group, id, currency, ids, env, transport),
    abort: (user, group, id) => abortRestoreLock(user, group, id, env, transport),
    stage: (group, id, rows) => stageRestoreReceipts(group, id, rows, env, transport),
    inventory: (user, group, id) => collectLiveRestoreInventory(user, group, env, transport, id),
    commit: (user, group, id, data, live, staged) => commitGroupRestoreV2(user, group, id, data, live, staged, env, transport),
    outcome: (user, group, id) => readRestoreOutcome(user, group, id, env, transport),
    cleanup: (user, group, id) => retryRestoreCleanup(user, group, id, env, transport),
  };
  let locked = false;
  let committed = false;
  try {
    try { await operations.begin(uid, groupId, restoreId, backup.group.currency, expectedPublicIds); locked = true; }
    catch (error) {
      try { locked = await operations.outcome(uid, groupId, restoreId) === 'locked'; }
      catch { /* No proof of a lock: keep the original error. */ }
      if (locked) throw new RestoreOrchestrationError('recovery_required', { cause: error });
      throw error;
    }
    const staged = await operations.stage(groupId, restoreId, receipts);
    const live = await operations.inventory(uid, groupId, restoreId);
    try { await operations.commit(uid, groupId, restoreId, backup, live, staged); committed = true; }
    catch (error) {
      let outcome: 'committed' | 'locked';
      try { outcome = await operations.outcome(uid, groupId, restoreId); }
      catch { throw new RestoreOrchestrationError('recovery_required', { cause: error }); }
      if (outcome === 'committed') committed = true;
      else throw error;
    }
    try { await operations.cleanup(uid, groupId, restoreId); return { restoreId, cleanupPending: false }; }
    catch { return { restoreId, cleanupPending: true }; }
  } catch (error) {
    if (locked && !committed && !(error instanceof RestoreOrchestrationError && error.code === 'recovery_required')) {
      try {
        await operations.abort(uid, groupId, restoreId);
        await operations.cleanup(uid, groupId, restoreId);
      } catch { throw new RestoreOrchestrationError('recovery_required', { cause: error }); }
    }
    throw error;
  }
}
