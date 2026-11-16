import { decodeBackupZipV2 } from './backup-zip-v2';
import type { GroupExportV2 } from './export-v2';

export interface BackupRestorePreviewV2 {
  readonly groupId: string;
  readonly groupName: string;
  readonly exportedAt: string;
  readonly scope: 'group-v2-partial';
  readonly counts: Readonly<{
    members: number; expenses: number; settlements: number; fxSettlements: number; importedRecords: number;
    categories: number; receiptMetadata: number; privateReceiptFiles: number;
  }>;
  readonly omitted: readonly string[];
}

/** Verifies an archive and describes it without restoring any data. */
export async function previewBackupRestoreV2(zip: Uint8Array): Promise<BackupRestorePreviewV2> {
  const data = await decodeBackupZipV2(zip);
  const group = JSON.parse(data.groupJson) as GroupExportV2;
  return {
    groupId: group.group.id, groupName: group.group.name, exportedAt: group.exportedAt, scope: data.manifest.scope,
    counts: {
      members: group.members.length, expenses: group.expenses.length, settlements: group.settlements.length,
      fxSettlements: group.fxSettlements.length, importedRecords: group.importedRecords.length,
      categories: group.categories.length, receiptMetadata: group.receipts.length, privateReceiptFiles: data.receipts.length,
    },
    omitted: ['comptes et identités Auth', 'préférences personnelles', 'commentaires', 'journal d’activité', 'instantané transactionnel'],
  };
}
