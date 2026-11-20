import { listCollectionPageInTransaction, readDocumentInTransaction } from './firestore-transaction-read';
import { unavailableCode } from './provider-quota';
import { serviceAccessToken } from './service-account';

export interface BackupPreferencesEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export interface BackupPreferenceRow {
  readonly userId: string;
  readonly modeJson: string | null;
  readonly memberIds: readonly string[];
  readonly updatedAt: string | null;
}
export class BackupPreferencesError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
type Field = { stringValue?: string; timestampValue?: string; arrayValue?: { values?: { stringValue?: string }[] } };
type Document = { name?: string; fields?: Record<string, Field> };

function selectedMembers(modeJson: string): string[] {
  let mode: Record<string, unknown>;
  try { mode = JSON.parse(modeJson) as Record<string, unknown>; }
  catch { throw new BackupPreferencesError(503, 'invalid_preference'); }
  const entries = mode['kind'] === 'equal' ? mode['users'] : mode['kind'] === 'exact' ? mode['amounts'] :
    mode['kind'] === 'percentage' ? mode['weightsBasisPoints'] : mode['kind'] === 'shares' ? mode['weights'] :
      mode['kind'] === 'adjustment' ? mode['adjustments'] : null;
  if (!Array.isArray(entries) || !entries.length) throw new BackupPreferencesError(503, 'invalid_preference');
  const ids = entries.map(item => mode['kind'] === 'equal' ? item : item?.userId);
  if (ids.some(item => typeof item !== 'string' || !idPattern.test(item)) || new Set(ids).size !== ids.length) throw new BackupPreferencesError(503, 'invalid_preference');
  return ids as string[];
}

async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new BackupPreferencesError(response.status === 409 ? 409 : 503, response.status === 409 ? 'snapshot_conflict' : unavailableCode(response, 'firestore_unavailable'));
  return await response.json() as Record<string, unknown>;
}

/** Owner-scoped, read-only snapshot of every group member's saved split preference. */
export async function collectBackupPreferences(uid: string, groupId: string, env: BackupPreferencesEnv, transport: typeof fetch = fetch): Promise<BackupPreferenceRow[]> {
  if (!idPattern.test(uid) || !idPattern.test(groupId)) throw new BackupPreferencesError(400, 'invalid_group');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new BackupPreferencesError(503, 'snapshot_unavailable');
  const transaction = begin['transaction'];
  try {
    const read = async (path: string): Promise<Document | null> => {
      const response = await readDocumentInTransaction(root, path, transaction, headers, transport);
      return response.status === 404 ? null : await checked(response) as Document;
    };
    const group = await read(`groups/${groupId}`);
    const caller = await read(`groups/${groupId}/members/${uid}`);
    if (!['active', 'archived'].includes(group?.fields?.['status']?.stringValue ?? '') || caller?.fields?.['status']?.stringValue !== 'active' || caller.fields['role']?.stringValue !== 'owner') throw new BackupPreferencesError(403, 'owner_required');
    const listed = await checked(await listCollectionPageInTransaction(root, `groups/${groupId}/members`, 51, transaction, headers, transport));
    if (listed['nextPageToken']) throw new BackupPreferencesError(409, 'too_many_members');
    const documents = listed['documents'];
    if (!Array.isArray(documents) || !documents.length || documents.length > 50) throw new BackupPreferencesError(409, 'invalid_members');
    const rows: BackupPreferenceRow[] = [];
    const seen = new Set<string>();
    for (const member of documents as Document[]) {
      const userId = member.name?.slice(member.name.lastIndexOf('/') + 1);
      if (!userId || !idPattern.test(userId) || !member.name?.startsWith(`${root}/groups/${groupId}/members/`) || seen.has(userId) || !['active', 'revoked'].includes(member.fields?.['status']?.stringValue ?? '')) throw new BackupPreferencesError(503, 'invalid_members');
      seen.add(userId);
      const preference = await read(`users/${userId}/groupPreferences/${groupId}`);
      if (!preference) { rows.push({ userId, modeJson: null, memberIds: [], updatedAt: null }); continue; }
      const fields = preference.fields;
      const modeJson = fields?.['modeJson']?.stringValue;
      const updatedAt = fields?.['updatedAt']?.timestampValue;
      const values = fields?.['memberIds']?.arrayValue?.values;
      const time = updatedAt ? new Date(updatedAt) : null;
      if (!modeJson || !time || Number.isNaN(time.getTime()) || (values !== undefined && (!Array.isArray(values) || values.some(item => !item.stringValue || !idPattern.test(item.stringValue))))) throw new BackupPreferencesError(503, 'invalid_preference');
      const selected = selectedMembers(modeJson);
      const memberIds = values?.map(item => item.stringValue!) ?? selected;
      if (memberIds.length !== selected.length || memberIds.some((id, index) => id !== selected[index])) throw new BackupPreferencesError(503, 'invalid_preference');
      rows.push({ userId, modeJson, memberIds, updatedAt: time.toISOString() });
    }
    if (!seen.has(uid)) throw new BackupPreferencesError(503, 'invalid_members');
    if (rows.some(row => row.memberIds.some(memberId => !seen.has(memberId)))) throw new BackupPreferencesError(503, 'invalid_preference');
    return rows;
  } finally {
    try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
    catch { /* The read-only snapshot expires if rollback is unavailable. */ }
  }
}
