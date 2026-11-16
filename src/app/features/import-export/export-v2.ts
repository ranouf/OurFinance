import { serializeGroupExportV1, type GroupExportV1 } from './export-v1';

/** Schema only: collection and restoration require privileged, separately tested routes. */
export interface GroupExportV2 extends Omit<GroupExportV1, 'version'> {
  readonly version: 2;
  /** Required to preserve author-only edit and delete rights after restoration. */
  readonly expenseAuthors: readonly { readonly expenseId: string; readonly userId: string }[];
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
  return `${JSON.stringify({ ...group, version: 2, expenseAuthors, preferences }, null, 2)}\n`;
}
