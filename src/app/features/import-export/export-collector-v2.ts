import type { User } from 'firebase/auth';
import { collectGroupExportV1, type ExportReader } from './export-collector';
import type { GroupExportV1 } from './export-v1';
import { serializeGroupExportV2, type GroupExportV2 } from './export-v2';

const timestamp = (value: unknown): string => typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function'
  ? (value as { toDate(): Date }).toDate().toISOString() : value as string;

/** Collects member preferences through the owner-authorized Worker route. */
export async function collectGroupExportV2(
  reader: ExportReader,
  user: Pick<User, 'uid' | 'emailVerified' | 'getIdToken'>,
  groupId: string,
  workerUrl: string,
  transport: typeof fetch = fetch,
): Promise<string> {
  const group = JSON.parse(await collectGroupExportV1(reader, user, groupId)) as GroupExportV1;
  const expenses = await reader.list(`groups/${groupId}/expenses`);
  const authors = new Map(expenses.map(row => [row.id, row.data['createdBy']]));
  if (authors.size !== expenses.length || expenses.length !== group.expenses.length ||
      group.expenses.some(row => typeof authors.get(row.id) !== 'string')) throw new Error('Auteurs des dépenses incomplets');
  const expenseAuthors = group.expenses.map(row => ({ expenseId: row.id, userId: authors.get(row.id) as string }));
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
  const url = new URL(`/groups/${encodeURIComponent(groupId)}/backup/preferences`, workerUrl);
  if (url.protocol !== 'https:') throw new Error('URL de sauvegarde non sécurisée');
  const response = await transport(url, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Préférences de sauvegarde indisponibles (HTTP ${response.status})`);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('preferences' in result) || !Array.isArray(result.preferences)) throw new Error('Réponse de sauvegarde invalide');
  const rows = result.preferences as GroupExportV2['preferences'];
  const byUser = new Map(rows.map(row => [row.userId, row]));
  if (byUser.size !== rows.length || rows.length !== group.members.length || rows.some(row => !group.members.some(member => member.userId === row.userId))) throw new Error('Préférences de sauvegarde incohérentes');
  const preferences = group.members.map(member => {
    const row = byUser.get(member.userId);
    if (!row) throw new Error('Préférences de sauvegarde incomplètes');
    return row;
  });
  if ((await reader.read(`groups/${groupId}/members/${user.uid}`))?.data['status'] !== 'active') throw new Error('Membre révoqué pendant la sauvegarde');
  return serializeGroupExportV2({ ...group, version: 2, expenseAuthors, comments, activity, preferences });
}
