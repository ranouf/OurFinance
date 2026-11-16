import { serializeGroupExportV2, type GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { compareRestoreInventoryV2 } from '../../../src/app/features/import-export/restore-inventory-v2';
import type { StagedRestoreReceipt } from './restore-media';
import type { LiveRestoreInventory } from './restore-inventory';
import { authorizedReceiptPublicId } from './media';

type Value = Record<string, unknown>;
const string = (value: string): Value => ({ stringValue: value });
const integer = (value: number): Value => ({ integerValue: String(value) });
const bool = (value: boolean): Value => ({ booleanValue: value });
const time = (value: string): Value => ({ timestampValue: value });
const array = (values: readonly Value[]): Value => ({ arrayValue: { values } });
const map = (fields: Record<string, Value>): Value => ({ mapValue: { fields } });
const moneyParts = (values: readonly { userId: string; amountMinor: number }[]): Value => array(values.map(item => map({ userId: string(item.userId), amountMinor: integer(item.amountMinor) })));

export interface RestoreWrites {
  readonly writes: readonly Record<string, unknown>[];
  readonly previousReceiptPublicIds: readonly string[];
}

/** Pure atomic-write plan. The caller must recheck owner, currency, members and live paths inside the same transaction. */
export function buildRestoreWrites(value: GroupExportV2, live: LiveRestoreInventory, staged: readonly StagedRestoreReceipt[], projectId: string, now: string): RestoreWrites {
  const backup = JSON.parse(serializeGroupExportV2(value)) as GroupExportV2;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(projectId) || Number.isNaN(Date.parse(now))) throw new Error('Contexte de restauration invalide');
  const diff = compareRestoreInventoryV2(backup, live.groupDocuments, live.userDocuments);
  const active = backup.receipts.filter(row => row.status === 'active');
  const stagedByReceipt = new Map(staged.map(row => [`${row.expenseId}/${row.attachmentId}`, row]));
  if (stagedByReceipt.size !== staged.length || staged.length !== active.length || active.some(row => {
    const item = stagedByReceipt.get(`${row.expenseId}/${row.attachmentId}`);
    return !item || item.format !== row.format || !authorizedReceiptPublicId(item.publicId, backup.group.id, row.expenseId, row.attachmentId) ||
      !item.publicId.includes('/restore_');
  })) throw new Error('Reçus préparés incomplets');
  const root = `projects/${projectId}/databases/(default)/documents`;
  const writes: Record<string, unknown>[] = [];
  const update = (path: string, fields: Record<string, Value>) => writes.push({ update: { name: `${root}/${path}`, fields } });
  const remove = (path: string) => writes.push({ delete: `${root}/${path}`, currentDocument: { exists: true } });
  const groupPath = `groups/${backup.group.id}`;
  for (const path of diff.deleteGroupDocuments) remove(path);
  for (const path of diff.deleteUserDocuments) remove(path);
  writes.push({ update: { name: `${root}/${groupPath}`, fields: { name: string(backup.group.name), status: string('active') } }, updateMask: { fieldPaths: ['name', 'status'] } });
  const authors = new Map(backup.expenseAuthors.map(row => [row.expenseId, row.userId]));
  for (const row of backup.expenses) update(`${groupPath}/expenses/${row.id}`, {
    date: string(row.date), description: string(row.description), currency: string(row.currency), amountMinor: integer(row.amountMinor),
    categoryId: string(row.categoryId), categoryLabel: string(row.categoryLabel), categoryIcon: string(row.categoryIcon), categoryColor: string(row.categoryColor),
    payments: moneyParts(row.payments), allocations: moneyParts(row.allocations), splitSnapshotJson: string(row.splitSnapshotJson),
    createdBy: string(authors.get(row.id)!), createdAt: time(now), deleted: bool(row.deleted), revision: integer(0),
    ...(row.deleted ? { deletedAt: time(now) } : {}),
  });
  for (const row of backup.comments) update(`${groupPath}/expenses/${row.expenseId}/comments/${row.id}`, {
    authorId: string(row.authorId), text: string(row.text), createdAt: time(row.createdAt),
  });
  const receiptOwners = new Map(backup.receiptOwners.map(row => [`${row.expenseId}/${row.attachmentId}`, row.ownerId]));
  for (const row of backup.receipts) {
    const key = `${row.expenseId}/${row.attachmentId}`;
    update(`${groupPath}/expenses/${row.expenseId}/attachments/${row.attachmentId}`, {
      publicId: string(stagedByReceipt.get(key)?.publicId ?? `ourfinance-test/${backup.group.id}/${key}`),
      format: string(row.format), type: string('authenticated'), status: string(row.status), ownerId: string(receiptOwners.get(key)!),
      createdAt: time(now), cleanupPending: bool(false),
    });
  }
  for (const row of backup.settlements) update(`${groupPath}/settlements/${row.id}`, {
    date: string(row.date), currency: string(row.currency), amountMinor: integer(row.amountMinor), fromUserId: string(row.fromUserId),
    toUserId: string(row.toUserId), status: string(row.status), deleted: bool(row.deleted), createdBy: string(row.fromUserId), createdAt: time(now),
  });
  for (const row of backup.importedRecords) update(`${groupPath}/importedRecords/${row.id}`, {
    sourceId: string(row.sourceId), batchId: string(row.batchId), date: string(row.date), description: string(row.description),
    currency: string(row.currency), amountMinor: integer(row.amountMinor), splitStatus: string(row.splitStatus), status: string(row.status),
    netImpactsMinor: map(Object.fromEntries(Object.entries(row.netImpactsMinor).map(([id, value]) => [id, integer(value)]))),
    createdAt: time(now), ...(row.status === 'undone' ? { undoneAt: time(now) } : {}),
  });
  const ownerId = backup.members.find(row => row.role === 'owner')!.userId;
  for (const row of backup.categories) update(`${groupPath}/categories/${row.id}`, {
    name: string(row.name), iconId: string(row.iconId), color: string(row.color), status: string(row.status),
    createdBy: string(ownerId), updatedBy: string(ownerId), createdAt: time(now), updatedAt: time(now),
  });
  for (const row of backup.activity) update(`${groupPath}/activity/${row.id}`, {
    actorId: string(row.actorId), action: string(row.action), at: time(row.at),
    ...Object.fromEntries(['expenseId', 'commentId', 'settlementId', 'batchId', 'categoryId']
      .filter(key => row[key as keyof typeof row] !== undefined)
      .map(key => [key, string(row[key as keyof typeof row] as string)])),
  });
  for (const row of backup.preferences) if (row.modeJson !== null) update(`users/${row.userId}/groupPreferences/${backup.group.id}`, {
    modeJson: string(row.modeJson), memberIds: array(row.memberIds.map(string)), updatedAt: time(row.updatedAt!),
  });
  for (const row of backup.importBatches) update(`users/${row.ownerId}/importBatches/${row.id}`, {
    groupId: string(backup.group.id), source: string(row.source), status: string(row.status), recordIds: array(row.recordIds.map(string)),
    createdAt: time(row.createdAt), ...(row.undoneAt ? { undoneAt: time(row.undoneAt) } : {}),
  });
  if (new TextEncoder().encode(JSON.stringify({ writes })).byteLength > 8_000_000) throw new Error('Restauration trop volumineuse pour une transaction');
  return { writes, previousReceiptPublicIds: live.receiptPublicIds };
}
