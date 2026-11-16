import type { User } from 'firebase/auth';
import { collectGroupExportV1, type ExportReader } from './export-collector';
import type { GroupExportV1 } from './export-v1';
import { serializeGroupExportV2, type GroupExportV2 } from './export-v2';

/** Collects member preferences through the owner-authorized Worker route. */
export async function collectGroupExportV2(
  reader: ExportReader,
  user: Pick<User, 'uid' | 'emailVerified' | 'getIdToken'>,
  groupId: string,
  workerUrl: string,
  transport: typeof fetch = fetch,
): Promise<string> {
  const group = JSON.parse(await collectGroupExportV1(reader, user, groupId)) as GroupExportV1;
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
  return serializeGroupExportV2({ ...group, version: 2, preferences });
}
