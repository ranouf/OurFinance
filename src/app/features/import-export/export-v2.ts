import { serializeGroupExportV1, type GroupExportV1 } from './export-v1';

/** Schema only: collection and restoration require privileged, separately tested routes. */
export interface GroupExportV2 extends Omit<GroupExportV1, 'version'> {
  readonly version: 2;
  /** Required to preserve author-only edit and delete rights after restoration. */
  readonly expenseAuthors: readonly { readonly expenseId: string; readonly userId: string }[];
  readonly receiptOwners: readonly { readonly expenseId: string; readonly attachmentId: string; readonly ownerId: string }[];
  readonly comments: readonly { readonly expenseId: string; readonly id: string; readonly authorId: string; readonly text: string; readonly createdAt: string }[];
  readonly activity: readonly { readonly id: string; readonly actorId: string; readonly action: string; readonly at: string;
    readonly expenseId?: string; readonly commentId?: string; readonly settlementId?: string; readonly batchId?: string; readonly categoryId?: string }[];
  readonly importBatches: readonly { readonly id: string; readonly ownerId: string; readonly status: 'active' | 'undone'; readonly source: 'splitwise_csv';
    readonly recordIds: readonly string[]; readonly createdAt: string; readonly undoneAt: string | null }[];
  /** One row per member, including members who have never saved a split. */
  readonly preferences: readonly {
    readonly userId: string;
    readonly modeJson: string | null;
    readonly memberIds: readonly string[];
    readonly updatedAt: string | null;
  }[];
}

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const isoTime = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Répartition personnelle invalide');
  return value as Record<string, unknown>;
};
const participants = (value: unknown, members: ReadonlySet<string>): Record<string, unknown>[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error('Participants de préférence invalides');
  const entries = value.map(record);
  const ids = entries.map(item => item['userId']);
  if (ids.some(item => typeof item !== 'string' || !idPattern.test(item) || !members.has(item)) || new Set(ids).size !== ids.length) throw new Error('Participants de préférence invalides');
  return entries;
};

function normalizeMode(modeJson: string, members: ReadonlySet<string>): { modeJson: string; memberIds: string[] } {
  if (modeJson.length > 4096) throw new Error('Préférence trop longue');
  let mode: Record<string, unknown>;
  try { mode = record(JSON.parse(modeJson)); }
  catch { throw new Error('Répartition personnelle invalide'); }
  let normalized: Record<string, unknown>;
  let ids: string[];
  if (mode['kind'] === 'equal') {
    const users = mode['users'];
    if (!Array.isArray(users) || users.length < 1 || users.length > 20 || users.some(item => typeof item !== 'string' || !idPattern.test(item) || !members.has(item)) || new Set(users).size !== users.length) throw new Error('Participants de préférence invalides');
    ids = [...users] as string[];
    normalized = { kind: 'equal', users: ids };
  } else if (mode['kind'] === 'exact' || mode['kind'] === 'adjustment') {
    const key = mode['kind'] === 'exact' ? 'amounts' : 'adjustments';
    const entries = participants(mode[key], members);
    const values = entries.map(item => {
      if (!Number.isSafeInteger(item['amountMinor']) || (mode['kind'] === 'exact' && (item['amountMinor'] as number) < 0)) throw new Error('Montant de préférence invalide');
      return { userId: item['userId'] as string, amountMinor: item['amountMinor'] as number };
    });
    ids = values.map(item => item.userId);
    normalized = { kind: mode['kind'], [key]: values };
  } else if (mode['kind'] === 'percentage' || mode['kind'] === 'shares') {
    const key = mode['kind'] === 'percentage' ? 'weightsBasisPoints' : 'weights';
    const entries = participants(mode[key], members);
    const values = entries.map(item => {
      if (!Number.isSafeInteger(item['value']) || (item['value'] as number) < 0) throw new Error('Poids de préférence invalide');
      return { userId: item['userId'] as string, value: item['value'] as number };
    });
    if (mode['kind'] === 'percentage' && values.reduce((sum, item) => sum + item.value, 0) !== 10000) throw new Error('Pourcentage de préférence invalide');
    if (mode['kind'] === 'shares' && values.every(item => item.value === 0)) throw new Error('Parts de préférence invalides');
    ids = values.map(item => item.userId);
    normalized = { kind: mode['kind'], [key]: values };
  } else throw new Error('Méthode de préférence invalide');
  return { modeJson: JSON.stringify(normalized), memberIds: ids };
}

/** A V2 document explicitly preserves each member's split preference or its absence. */
export function serializeGroupExportV2(value: GroupExportV2): string {
  if (value.version !== 2 || !Array.isArray(value.preferences) || value.preferences.length !== value.members.length) throw new Error('Préférences de groupe incomplètes');
  const group = JSON.parse(serializeGroupExportV1({ ...value, version: 1 })) as GroupExportV1;
  const members = new Set(group.members.map(item => item.userId));
  if (group.members.filter(item => item.role === 'owner' && item.status === 'active').length !== 1 ||
      group.members.some(item => item.role === 'owner' && item.status !== 'active')) throw new Error('Propriétaire du groupe invalide');
  if (!Array.isArray(value.expenseAuthors) || value.expenseAuthors.length !== group.expenses.length ||
      value.expenseAuthors.some((row, index) => !row || row.expenseId !== group.expenses[index].id || !members.has(row.userId))) {
    throw new Error('Auteurs des dépenses incomplets');
  }
  const expenseAuthors = value.expenseAuthors.map(row => ({ expenseId: row.expenseId, userId: row.userId }));
  if (!Array.isArray(value.receiptOwners) || value.receiptOwners.length !== group.receipts.length ||
      value.receiptOwners.some((row, index) => !row || row.expenseId !== group.receipts[index].expenseId ||
        row.attachmentId !== group.receipts[index].attachmentId || !members.has(row.ownerId))) {
    throw new Error('Propriétaires des reçus incomplets');
  }
  const receiptOwners = value.receiptOwners.map(row => ({ expenseId: row.expenseId, attachmentId: row.attachmentId, ownerId: row.ownerId }));
  const expenseIds = new Set(group.expenses.map(row => row.id));
  if (!Array.isArray(value.comments) || new Set(value.comments.map(row => `${row?.expenseId}/${row?.id}`)).size !== value.comments.length ||
      value.comments.some(row => !row || !expenseIds.has(row.expenseId) || !idPattern.test(row.id) ||
        !members.has(row.authorId) || typeof row.text !== 'string' || !row.text.trim() || row.text.length > 1000 || !isoTime(row.createdAt))) {
    throw new Error('Commentaires de sauvegarde invalides');
  }
  const comments = value.comments.map(row => ({ expenseId: row.expenseId, id: row.id, authorId: row.authorId, text: row.text, createdAt: row.createdAt }));
  const actions = new Set(['expense_created', 'expense_updated', 'expense_deleted', 'settlement_recorded', 'comment_created', 'import_created', 'import_undone', 'category_created', 'category_updated', 'category_archived', 'category_reactivated']);
  const settlementIds = new Set(group.settlements.map(row => row.id));
  const categoryIds = new Set(group.categories.map(row => row.id));
  const batchIds = new Set(group.importedRecords.map(row => row.batchId));
  const commentIds = new Set(comments.map(row => `${row.expenseId}/${row.id}`));
  if (!Array.isArray(value.activity) || new Set(value.activity.map(row => row?.id)).size !== value.activity.length ||
      value.activity.some(row => !row || !idPattern.test(row.id) || !members.has(row.actorId) || !actions.has(row.action) || !isoTime(row.at) ||
        (row.action.startsWith('expense_') && !expenseIds.has(row.expenseId ?? '')) ||
        (row.action === 'comment_created' && !commentIds.has(`${row.expenseId}/${row.commentId}`)) ||
        (row.action === 'settlement_recorded' && !settlementIds.has(row.settlementId ?? '')) ||
        (row.action.startsWith('import_') && !batchIds.has(row.batchId ?? '')) ||
        (row.action.startsWith('category_') && !categoryIds.has(row.categoryId ?? '')) ||
        ['expenseId', 'commentId', 'settlementId', 'batchId', 'categoryId'].some(key => {
          const item = row[key as keyof typeof row];
          return item !== undefined && (typeof item !== 'string' || !idPattern.test(item));
        }))) throw new Error('Activité de sauvegarde invalide');
  const activity = value.activity.map(row => ({ id: row.id, actorId: row.actorId, action: row.action, at: row.at,
    ...(row.expenseId === undefined ? {} : { expenseId: row.expenseId }),
    ...(row.commentId === undefined ? {} : { commentId: row.commentId }),
    ...(row.settlementId === undefined ? {} : { settlementId: row.settlementId }),
    ...(row.batchId === undefined ? {} : { batchId: row.batchId }),
    ...(row.categoryId === undefined ? {} : { categoryId: row.categoryId }) }));
  const recordIdsByBatch = new Map<string, string[]>();
  for (const row of group.importedRecords) recordIdsByBatch.set(row.batchId, [...(recordIdsByBatch.get(row.batchId) ?? []), row.id]);
  if (!Array.isArray(value.importBatches) || new Set(value.importBatches.map(row => row?.id)).size !== value.importBatches.length ||
      value.importBatches.length !== recordIdsByBatch.size || value.importBatches.some(row => {
        if (!row || !idPattern.test(row.id) || !members.has(row.ownerId) || row.source !== 'splitwise_csv' ||
            !['active', 'undone'].includes(row.status) || !isoTime(row.createdAt) ||
            (row.status === 'undone' ? !isoTime(row.undoneAt) : row.undoneAt !== null) ||
            !Array.isArray(row.recordIds) || !recordIdsByBatch.has(row.id)) return true;
        const expected = recordIdsByBatch.get(row.id)!;
        return row.recordIds.length !== expected.length || new Set(row.recordIds).size !== expected.length ||
          row.recordIds.some((id: string) => !expected.includes(id));
      })) throw new Error('Lots d’import incomplets');
  const importBatches = value.importBatches.map(row => ({ id: row.id, ownerId: row.ownerId, status: row.status, source: row.source,
    recordIds: [...row.recordIds], createdAt: row.createdAt, undoneAt: row.undoneAt }));
  const preferences = value.preferences.map((row: GroupExportV2['preferences'][number], index: number) => {
    if (!row || row.userId !== group.members[index].userId || !Array.isArray(row.memberIds)) throw new Error('Préférences de groupe incohérentes');
    if (row.modeJson === null) {
      if (row.memberIds.length || row.updatedAt !== null) throw new Error('Préférence absente incohérente');
      return { userId: row.userId, modeJson: null, memberIds: [], updatedAt: null };
    }
    if (typeof row.modeJson !== 'string' || !isoTime(row.updatedAt)) throw new Error('Préférence personnelle invalide');
    const mode = normalizeMode(row.modeJson, members);
    if (row.memberIds.length !== mode.memberIds.length || row.memberIds.some((id, i) => id !== mode.memberIds[i])) throw new Error('Participants de préférence incohérents');
    return { userId: row.userId, modeJson: mode.modeJson, memberIds: mode.memberIds, updatedAt: row.updatedAt };
  });
  return `${JSON.stringify({ ...group, version: 2, expenseAuthors, receiptOwners, comments, activity, importBatches, preferences }, null, 2)}\n`;
}
