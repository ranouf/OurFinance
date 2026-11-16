import type { User } from 'firebase/auth';
import { collectGroupExportV1, type ExportReader } from './export-collector';
import type { GroupExportV1 } from './export-v1';
import { serializeGroupExportV2, type GroupExportV2 } from './export-v2';

const timestamp = (value: unknown): string => typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function'
  ? (value as { toDate(): Date }).toDate().toISOString() : value as string;
const selectedMembers = (modeJson: string): string[] => {
  const mode = JSON.parse(modeJson) as Record<string, unknown>;
  const entries = mode['kind'] === 'equal' ? mode['users'] : mode['kind'] === 'exact' ? mode['amounts'] :
    mode['kind'] === 'percentage' ? mode['weightsBasisPoints'] : mode['kind'] === 'shares' ? mode['weights'] :
      mode['kind'] === 'adjustment' ? mode['adjustments'] : null;
  if (!Array.isArray(entries)) throw new Error('Préférence personnelle invalide');
  return entries.map(item => mode['kind'] === 'equal' ? item : item?.userId) as string[];
};

async function collectGroupExportV2WithPreferences(
  reader: ExportReader,
  user: Pick<User, 'uid' | 'emailVerified'>,
  groupId: string,
  snapshotMode: GroupExportV2['snapshotMode'],
  getPreferences: (memberIds: readonly string[]) => Promise<GroupExportV2['preferences']>,
): Promise<string> {
  const group = JSON.parse(await collectGroupExportV1(reader, user, groupId)) as GroupExportV1;
  const expenses = await reader.list(`groups/${groupId}/expenses`);
  const authors = new Map(expenses.map(row => [row.id, row.data['createdBy']]));
  if (authors.size !== expenses.length || expenses.length !== group.expenses.length ||
      group.expenses.some(row => typeof authors.get(row.id) !== 'string')) throw new Error('Auteurs des dépenses incomplets');
  const expenseAuthors = group.expenses.map(row => ({ expenseId: row.id, userId: authors.get(row.id) as string }));
  const receiptPages = await Promise.all(group.expenses.map(row => reader.list(`groups/${groupId}/expenses/${row.id}/attachments`)));
  const receiptOwners = receiptPages.flatMap((page, index) => page.map(item => ({
    expenseId: group.expenses[index].id, attachmentId: item.id, ownerId: item.data['ownerId'] as string,
  })));
  if (receiptOwners.length !== group.receipts.length || receiptOwners.some((row, index) =>
    row.expenseId !== group.receipts[index].expenseId || row.attachmentId !== group.receipts[index].attachmentId)) {
    throw new Error('Reçus modifiés pendant la sauvegarde');
  }
  const commentPages = await Promise.all(group.expenses.map(row => reader.list(`groups/${groupId}/expenses/${row.id}/comments`)));
  const comments = commentPages.flatMap((page, index) => page.map(item => ({
    expenseId: group.expenses[index].id, id: item.id,
    authorId: item.data['authorId'] as string, text: item.data['text'] as string,
    createdAt: timestamp(item.data['createdAt']),
  })));
  const activity = (await reader.list(`groups/${groupId}/activity`)).map(item => ({ id: item.id,
    actorId: item.data['actorId'] as string, action: item.data['action'] as string, at: timestamp(item.data['at']),
    ...Object.fromEntries(['expenseId', 'commentId', 'settlementId', 'batchId', 'categoryId']
      .filter(key => item.data[key] !== undefined).map(key => [key, item.data[key]])),
  }));
  const owner = group.members.find(member => member.role === 'owner' && member.status === 'active');
  if (owner?.userId !== user.uid) throw new Error('Sauvegarde réservée au propriétaire');
  const importBatches = (await reader.list(`users/${user.uid}/importBatches`))
    .filter(item => item.data['groupId'] === groupId)
    .map(item => ({ id: item.id, ownerId: user.uid, status: item.data['status'] as 'active' | 'undone',
      source: item.data['source'] as 'splitwise_csv', recordIds: item.data['recordIds'] as string[],
      createdAt: timestamp(item.data['createdAt']),
      undoneAt: item.data['status'] === 'undone' ? timestamp(item.data['undoneAt']) : null }));
  const rows = await getPreferences(group.members.map(member => member.userId));
  const byUser = new Map(rows.map(row => [row.userId, row]));
  if (byUser.size !== rows.length || rows.length !== group.members.length || rows.some(row => !group.members.some(member => member.userId === row.userId))) throw new Error('Préférences de sauvegarde incohérentes');
  const preferences = group.members.map(member => {
    const row = byUser.get(member.userId);
    if (!row) throw new Error('Préférences de sauvegarde incomplètes');
    return row;
  });
  if ((await reader.read(`groups/${groupId}/members/${user.uid}`))?.data['status'] !== 'active') throw new Error('Membre révoqué pendant la sauvegarde');
  return serializeGroupExportV2({ ...group, version: 2, snapshotMode, expenseAuthors, receiptOwners, comments, activity, importBatches, preferences });
}

/** Client collection remains partial because preferences are fetched in a separate Worker snapshot. */
export async function collectGroupExportV2(
  reader: ExportReader,
  user: Pick<User, 'uid' | 'emailVerified' | 'getIdToken'>,
  groupId: string,
  workerUrl: string,
  transport: typeof fetch = fetch,
): Promise<string> {
  return collectGroupExportV2WithPreferences(reader, user, groupId, 'client_partial', async () => {
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/backup/preferences`, workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL de sauvegarde non sécurisée');
    const response = await transport(url, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Préférences de sauvegarde indisponibles (HTTP ${response.status})`);
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('preferences' in result) || !Array.isArray(result.preferences)) throw new Error('Réponse de sauvegarde invalide');
    return result.preferences as GroupExportV2['preferences'];
  });
}

/** All reads through this reader must share one Firestore read transaction. */
export async function collectGroupExportV2FromReader(reader: ExportReader, user: Pick<User, 'uid' | 'emailVerified'>, groupId: string): Promise<string> {
  return collectGroupExportV2WithPreferences(reader, user, groupId, 'server_transaction', async memberIds => Promise.all(memberIds.map(async userId => {
    const document = await reader.read(`users/${userId}/groupPreferences/${groupId}`);
    if (!document) return { userId, modeJson: null, memberIds: [], updatedAt: null };
    const modeJson = document.data['modeJson'] as string;
    return { userId, modeJson, memberIds: (document.data['memberIds'] as string[] | undefined) ?? selectedMembers(modeJson),
      updatedAt: timestamp(document.data['updatedAt']) };
  })));
}
