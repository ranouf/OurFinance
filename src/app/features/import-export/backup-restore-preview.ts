import { decodeBackupZipV1 } from './backup-zip-read';
import type { GroupExportV1 } from './export-v1';

export interface BackupRestorePreviewV1 {
  readonly groupId: string;
  readonly groupName: string;
  readonly exportedAt: string;
  readonly scope: 'group-v1-partial';
  readonly counts: Readonly<{
    members: number; expenses: number; settlements: number; importedRecords: number;
    categories: number; receiptMetadata: number; privateReceiptFiles: number;
  }>;
  readonly omitted: readonly string[];
}

/** Examines a verified archive without writing accounts, documents or media. */
export async function previewBackupRestoreV1(zip: Uint8Array): Promise<BackupRestorePreviewV1> {
  const packageData = await decodeBackupZipV1(zip);
  const group = JSON.parse(packageData.groupJson) as GroupExportV1;
  return {
    groupId: group.group.id,
    groupName: group.group.name,
    exportedAt: group.exportedAt,
    scope: packageData.manifest.scope,
    counts: {
      members: group.members.length,
      expenses: group.expenses.length,
      settlements: group.settlements.length,
      importedRecords: group.importedRecords.length,
      categories: group.categories.length,
      receiptMetadata: group.receipts.length,
      privateReceiptFiles: packageData.receipts.length,
    },
    omitted: ['comptes et identités Auth', 'préférences personnelles', 'commentaires', 'journal d’activité', 'instantané transactionnel'],
  };
}
