import { validateGroupMetadata } from '../../../src/app/core/firebase/group-metadata';
import { unavailableCode } from './provider-quota';
import { serviceAccessToken } from './service-account';
import type { GroupEnv } from './groups';

export class GroupMetadataError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const field = (doc: Record<string, unknown> | null, key: string) =>
  (doc?.['fields'] as Record<string, { stringValue?: string }> | undefined)?.[key]?.stringValue;

/** An owner-only metadata update; currency and accounting fields are never in the update mask. */
export async function updateGroupMetadata(value: unknown, uid: string, groupId: string, env: GroupEnv, transport: typeof fetch = fetch): Promise<void> {
  if (!idPattern.test(uid) || !idPattern.test(groupId)) throw new GroupMetadataError(400, 'invalid_group');
  let metadata: ReturnType<typeof validateGroupMetadata>;
  try { metadata = validateGroupMetadata(value); }
  catch { throw new GroupMetadataError(400, 'invalid_group_metadata'); }
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const checked = async (response: Response) => {
    if (!response.ok) throw new GroupMetadataError(response.status === 409 ? 409 : 503, unavailableCode(response, 'firestore_unavailable'));
    return await response.json() as Record<string, unknown>;
  };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new GroupMetadataError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      return response.status === 404 ? null : await checked(response);
    };
    const group = await read(`groups/${groupId}`);
    const member = await read(`groups/${groupId}/members/${uid}`);
    if (field(group, 'status') !== 'active' || field(member, 'status') !== 'active' || field(member, 'role') !== 'owner')
      throw new GroupMetadataError(403, 'owner_required');
    const at = new Date().toISOString();
    const fields = { ...Object.fromEntries(Object.entries(metadata).map(([key, val]) => [key, { stringValue: val }])),
      updatedBy: { stringValue: uid }, updatedAt: { timestampValue: at } };
    const writes = [
      { update: { name: `${root}/groups/${groupId}`, fields }, updateMask: { fieldPaths: Object.keys(fields) } },
      { update: { name: `${root}/groups/${groupId}/activity/group_${crypto.randomUUID()}`,
        fields: { actorId: { stringValue: uid }, action: { stringValue: 'group_updated' }, at: { timestampValue: at } } }, currentDocument: { exists: false } },
    ];
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
    committed = true;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}
