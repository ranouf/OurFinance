import type { BackupPackageV2 } from '../../../src/app/features/import-export/backup-package-v2';
import { verifyBackupPackageV2 } from '../../../src/app/features/import-export/backup-package-v2';
import type { GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { compareRestoreInventoryV2 } from '../../../src/app/features/import-export/restore-inventory-v2';
import type { LiveRestoreInventory } from './restore-inventory';

export interface RestorePreviewCounts {
  readonly create: number;
  readonly replace: number;
  readonly delete: number;
}

/** Read-only counts for the user. The final transaction still recalculates the inventory. */
export async function summarizeRestorePreviewV2(
  archive: BackupPackageV2, groupId: string, live: LiveRestoreInventory,
): Promise<RestorePreviewCounts> {
  await verifyBackupPackageV2(archive);
  const backup = JSON.parse(archive.groupJson) as GroupExportV2;
  if (backup.snapshotMode !== 'server_transaction' || backup.group.id !== groupId) throw new Error('Instantané serveur requis');
  const diff = compareRestoreInventoryV2(backup, live.groupDocuments, live.userDocuments);
  const groupCurrent = new Set(live.groupDocuments);
  const userCurrent = new Set(live.userDocuments);
  // Member identities and membership references are retained, not rewritten.
  const groupWrites = diff.replaceGroupDocuments.filter(path => !path.startsWith(`groups/${groupId}/members/`));
  const userWrites = diff.replaceUserDocuments.filter(path => !path.includes('/groupMemberships/'));
  return {
    create: groupWrites.filter(path => !groupCurrent.has(path)).length + userWrites.filter(path => !userCurrent.has(path)).length,
    replace: groupWrites.filter(path => groupCurrent.has(path)).length + userWrites.filter(path => userCurrent.has(path)).length,
    delete: diff.deleteGroupDocuments.length + diff.deleteUserDocuments.length,
  };
}
