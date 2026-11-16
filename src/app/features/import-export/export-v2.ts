import { serializeGroupExportV1, type GroupExportV1 } from './export-v1';

/** Schema only: collection and restoration require privileged, separately tested routes. */
export interface GroupExportV2 extends Omit<GroupExportV1, 'version'> {
  readonly version: 2;
  /** Required to preserve author-only edit and delete rights after restoration. */
  readonly expenseAuthors: readonly { readonly expenseId: string; readonly userId: string }[];
  readonly comments: readonly { readonly expenseId: string; readonly id: string; readonly authorId: string; readonly text: string; readonly createdAt: string }[];
  readonly activity: readonly { readonly id: string; readonly actorId: string; readonly action: string; readonly at: string;
    readonly expenseId?: string; readonly commentId?: string; readonly settlementId?: string; readonly batchId?: string; readonly categoryId?: string }[];
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
  if (!Array.isArray(value.expenseAuthors) || value.expenseAuthors.length !== group.expenses.length ||
      value.expenseAuthors.some((row, index) => !row || row.expenseId !== group.expenses[index].id || !members.has(row.userId))) {
    throw new Error('Auteurs des dépenses incomplets');
  }
  const expenseAuthors = value.expenseAuthors.map(row => ({ expenseId: row.expenseId, userId: row.userId }));
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
  return `${JSON.stringify({ ...group, version: 2, expenseAuthors, comments, activity, preferences }, null, 2)}\n`;
}
