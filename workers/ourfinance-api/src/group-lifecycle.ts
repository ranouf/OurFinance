import { unavailableCode } from './provider-quota';
import { serviceAccessToken } from './service-account';

export interface GroupLifecycleEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export class GroupLifecycleError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const string = (stringValue: string) => ({ stringValue });
function field(document: Record<string, unknown> | null, name: string): string | undefined {
  return (document?.['fields'] as Record<string, { stringValue?: string }> | undefined)?.[name]?.stringValue;
}

/** Keep historical expenses and memberships; only access is revoked. */
export async function changeGroupLifecycle(
  action: 'revoke_member' | 'archive_group', groupId: string, actorId: string, targetId: string | undefined,
  env: GroupLifecycleEnv, transport: typeof fetch = fetch,
): Promise<void> {
  if (![groupId, actorId].every(id => idPattern.test(id)) ||
      (action === 'revoke_member' && (!targetId || !idPattern.test(targetId)))) {
    throw new GroupLifecycleError(400, 'invalid_group_lifecycle');
  }
  if (action === 'revoke_member' && targetId === actorId) throw new GroupLifecycleError(403, 'owner_required');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const checked = async (response: Response) => {
    if (!response.ok) throw new GroupLifecycleError(response.status === 409 ? 409 : 503,
      response.status === 409 ? 'transaction_conflict' : unavailableCode(response, 'group_unavailable'));
    return await response.json() as Record<string, unknown>;
  };
  const begun = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`,
    { method: 'POST', headers, body: '{}' }));
  const transaction = begun['transaction'];
  if (typeof transaction !== 'string') throw new GroupLifecycleError(503, 'transaction_unavailable');
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      return response.status === 404 ? null : await checked(response);
    };
    const group = await read(`groups/${groupId}`);
    const owner = await read(`groups/${groupId}/members/${actorId}`);
    if (field(group, 'status') !== 'active' || field(owner, 'status') !== 'active' || field(owner, 'role') !== 'owner') {
      throw new GroupLifecycleError(403, 'owner_required');
    }
    const now = new Date().toISOString();
    const writes: unknown[] = [];
    if (action === 'revoke_member') {
      const member = await read(`groups/${groupId}/members/${targetId}`);
      if (field(member, 'role') === 'owner') throw new GroupLifecycleError(403, 'owner_required');
      if (field(member, 'status') !== 'active') throw new GroupLifecycleError(409, 'member_inactive');
      writes.push(
        { update: { name: `${root}/groups/${groupId}/members/${targetId}`, fields: { status: string('revoked'), revokedAt: { timestampValue: now } } }, updateMask: { fieldPaths: ['status', 'revokedAt'] } },
        { update: { name: `${root}/users/${targetId}/groupMemberships/${groupId}`, fields: { status: string('revoked') } }, updateMask: { fieldPaths: ['status'] }, currentDocument: { exists: true } },
      );
    } else {
      writes.push({ update: { name: `${root}/groups/${groupId}`, fields: { status: string('archived'), archivedAt: { timestampValue: now } } }, updateMask: { fieldPaths: ['status', 'archivedAt'] } });
    }
    const eventId = crypto.randomUUID();
    writes.push({ update: { name: `${root}/groups/${groupId}/activity/${eventId}`, fields: {
      actorId: string(actorId), action: string(action === 'revoke_member' ? 'member_revoked' : 'group_archived'),
      ...(targetId ? { targetId: string(targetId) } : {}), at: { timestampValue: now },
    } }, currentDocument: { exists: false } });
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`,
      { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
    committed = true;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`,
        { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve original failure. */ }
    }
  }
}
