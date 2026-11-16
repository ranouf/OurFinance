import { serializeGroupExportV2, type GroupExportV2 } from './export-v2';

export interface RestoreInventoryV2 {
  readonly groupDocuments: readonly string[];
  readonly userDocuments: readonly string[];
  readonly receiptDocuments: readonly string[];
  readonly absentPreferenceDocuments: readonly string[];
}

/** Complete path inventory for comparing live documents before any destructive write. */
export function restoreInventoryV2(value: GroupExportV2): RestoreInventoryV2 {
  const backup = JSON.parse(serializeGroupExportV2(value)) as GroupExportV2;
  const root = `groups/${backup.group.id}`;
  const receiptDocuments = backup.receipts.map(row => `${root}/expenses/${row.expenseId}/attachments/${row.attachmentId}`);
  const groupDocuments = [
    root,
    ...backup.members.map(row => `${root}/members/${row.userId}`),
    ...backup.categories.map(row => `${root}/categories/${row.id}`),
    ...backup.expenses.map(row => `${root}/expenses/${row.id}`),
    ...backup.comments.map(row => `${root}/expenses/${row.expenseId}/comments/${row.id}`),
    ...receiptDocuments,
    ...backup.settlements.map(row => `${root}/settlements/${row.id}`),
    ...backup.importedRecords.map(row => `${root}/importedRecords/${row.id}`),
    ...backup.activity.map(row => `${root}/activity/${row.id}`),
  ];
  const userDocuments = [
    ...backup.members.map(row => `users/${row.userId}/groupMemberships/${backup.group.id}`),
    ...backup.preferences.map(row => `users/${row.userId}/groupPreferences/${backup.group.id}`),
    ...backup.importBatches.map(row => `users/${row.ownerId}/importBatches/${row.id}`),
  ];
  if (new Set(groupDocuments).size !== groupDocuments.length || new Set(userDocuments).size !== userDocuments.length) {
    throw new Error('Chemins de restauration ambigus');
  }
  const absentPreferenceDocuments = backup.preferences.filter(row => row.modeJson === null)
    .map(row => `users/${row.userId}/groupPreferences/${backup.group.id}`);
  return { groupDocuments, userDocuments, receiptDocuments, absentPreferenceDocuments };
}
