import { serviceAccessToken } from './service-account';

export interface RestoreCurrentEnv {
  readonly FIREBASE_PROJECT_ID: string;
  readonly FIREBASE_SERVICE_ACCOUNT_JSON: string;
}

export class RestoreCurrentError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}

export type CurrentRestore =
  | { readonly status: 'active' }
  | { readonly status: 'staging' | 'cleanup_pending'; readonly restoreId: string };

interface Document {
  readonly fields?: Record<string, { stringValue?: string }>;
}

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reveals only the current restore state to an active owner, so a lost tab can resume or abort safely. */
export async function readCurrentRestore(uid: string, groupId: string, env: RestoreCurrentEnv,
  transport: typeof fetch = fetch): Promise<CurrentRestore> {
  if (!idPattern.test(uid) || !idPattern.test(groupId)) throw new RestoreCurrentError(400, 'invalid_group');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const begin = await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, {
    method: 'POST', headers, body: JSON.stringify({ options: { readOnly: {} } }),
  });
  if (!begin.ok) throw new RestoreCurrentError(503, 'firestore_unavailable');
  const transaction = (await begin.json() as { transaction?: unknown }).transaction;
  if (typeof transaction !== 'string' || !transaction) throw new RestoreCurrentError(503, 'transaction_unavailable');
  try {
    const read = async (path: string): Promise<Document | null> => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      if (response.status === 404) return null;
      if (!response.ok) throw new RestoreCurrentError(503, 'firestore_unavailable');
      return await response.json() as Document;
    };
    const group = await read(`groups/${groupId}`);
    const member = await read(`groups/${groupId}/members/${uid}`);
    const groupFields = group?.fields;
    const memberFields = member?.fields;
    if (groupFields?.['ownerId']?.stringValue !== uid || memberFields?.['status']?.stringValue !== 'active' ||
        memberFields['role']?.stringValue !== 'owner') throw new RestoreCurrentError(403, 'owner_required');
    const groupStatus = groupFields['status']?.stringValue;
    if (groupStatus !== 'active' && groupStatus !== 'restoring') throw new RestoreCurrentError(409, 'group_changed');
    const restoreId = groupStatus === 'restoring'
      ? groupFields['restoreId']?.stringValue
      : groupFields['lastRestoreId']?.stringValue;
    if (groupStatus === 'active' && !restoreId) return { status: 'active' };
    if (!restoreId || !uuidPattern.test(restoreId)) throw new RestoreCurrentError(409, 'restore_state_invalid');
    if (groupStatus === 'restoring' && groupFields['restoreOwnerId']?.stringValue !== uid)
      throw new RestoreCurrentError(409, 'restore_state_invalid');
    const job = await read(`groups/${groupId}/restoreJobs/${restoreId}`);
    if (job?.fields?.['ownerId']?.stringValue !== uid) throw new RestoreCurrentError(409, 'restore_state_invalid');
    const jobStatus = job.fields['status']?.stringValue;
    if (groupStatus === 'restoring' && jobStatus === 'staging') return { status: 'staging', restoreId };
    if (groupStatus === 'active' && jobStatus === 'cleanup_pending') return { status: 'cleanup_pending', restoreId };
    if (groupStatus === 'active' && jobStatus === 'completed') return { status: 'active' };
    throw new RestoreCurrentError(409, 'restore_state_invalid');
  } finally {
    // A read-only Firestore transaction must still be closed on every success and refusal path.
    try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, {
      method: 'POST', headers, body: JSON.stringify({ transaction }),
    }); } catch { /* Preserve the read result or the original error. */ }
  }
}
