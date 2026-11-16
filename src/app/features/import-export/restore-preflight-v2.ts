import { serializeGroupExportV2, type GroupExportV2 } from './export-v2';
import { verifyBackupPackageV2, type BackupPackageV2 } from './backup-package-v2';

export interface RestoreTargetV2 {
  readonly groupId: string;
  readonly currency: string;
  readonly memberIds: readonly string[];
  readonly ownerId: string;
}
export interface RestorePreflightV2 {
  readonly groupId: string;
  readonly sourceExportedAt: string;
  readonly expenseCount: number;
  readonly settlementCount: number;
  readonly importCount: number;
  readonly importBatchCount: number;
  readonly commentCount: number;
  readonly activityCount: number;
  readonly receiptCount: number;
  readonly preferenceCount: number;
  readonly absentPreferenceCount: number;
}

/** Read-only gate: never directs a backup to a different group or member set. */
export function preflightGroupRestoreV2(groupJson: string, target: RestoreTargetV2): RestorePreflightV2 {
  if (new TextEncoder().encode(groupJson).byteLength > 10_000_000) throw new Error('Sauvegarde trop volumineuse');
  let parsed: GroupExportV2;
  try { parsed = JSON.parse(groupJson) as GroupExportV2; }
  catch { throw new Error('Sauvegarde JSON invalide'); }
  // Re-serialization checks money, links, preferences and declared fields.
  const source = JSON.parse(serializeGroupExportV2(parsed)) as GroupExportV2;
  if (source.group.id !== target.groupId) throw new Error('La sauvegarde appartient à un autre groupe');
  if (source.group.currency !== target.currency) throw new Error('Devise du groupe différente');
  if (source.members.find(member => member.role === 'owner')?.userId !== target.ownerId) throw new Error('Propriétaire du groupe différent');
  const members = new Set(target.memberIds);
  if (members.size !== target.memberIds.length || members.size !== source.members.length || source.members.some(member => !members.has(member.userId))) {
    throw new Error('Membres du groupe différents');
  }
  return {
    groupId: source.group.id,
    sourceExportedAt: source.exportedAt,
    expenseCount: source.expenses.length,
    settlementCount: source.settlements.length,
    importCount: source.importedRecords.length,
    importBatchCount: source.importBatches.length,
    commentCount: source.comments.length,
    activityCount: source.activity.length,
    receiptCount: source.receipts.length,
    preferenceCount: source.preferences.filter(row => row.modeJson !== null).length,
    absentPreferenceCount: source.preferences.filter(row => row.modeJson === null).length,
  };
}

/** Verify every archived receipt before presenting a restore against the original group. */
export async function preflightBackupRestoreV2(backup: BackupPackageV2, target: RestoreTargetV2): Promise<RestorePreflightV2> {
  await verifyBackupPackageV2(backup);
  return preflightGroupRestoreV2(backup.groupJson, target);
}
