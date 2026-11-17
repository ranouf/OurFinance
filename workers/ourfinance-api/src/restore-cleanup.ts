import { destroyAuthenticated, type CloudinaryEnv } from './cloudinary';
import { serviceAccessToken } from './service-account';

export interface RestoreCleanupEnv extends CloudinaryEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string }
export class RestoreCleanupError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}

/** Retryable cleanup journal; missing Cloudinary assets count as already removed. */
export async function retryRestoreCleanup(uid: string, groupId: string, restoreId: string, env: RestoreCleanupEnv, transport: typeof fetch = fetch): Promise<number> {
  if (![uid, groupId].every(id => /^[A-Za-z0-9_-]{1,128}$/.test(id)) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(restoreId)) throw new RestoreCleanupError(400, 'invalid_restore');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const read = async (path: string) => {
    const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}`, { headers });
    if (!response.ok) throw new RestoreCleanupError(response.status === 404 ? 409 : 503, 'cleanup_unavailable');
    return await response.json() as { fields?: Record<string, { stringValue?: string; arrayValue?: { values?: { stringValue?: string }[] } }> };
  };
  const [group, member, job] = await Promise.all([
    read(`groups/${groupId}`), read(`groups/${groupId}/members/${uid}`), read(`groups/${groupId}/restoreJobs/${restoreId}`),
  ]);
  if (group.fields?.['status']?.stringValue !== 'active' || group.fields['ownerId']?.stringValue !== uid ||
      member.fields?.['role']?.stringValue !== 'owner' || member.fields['status']?.stringValue !== 'active' ||
      job.fields?.['ownerId']?.stringValue !== uid) throw new RestoreCleanupError(403, 'owner_required');
  if (job.fields['status']?.stringValue === 'completed') return 0;
  if (job.fields['status']?.stringValue !== 'cleanup_pending') throw new RestoreCleanupError(409, 'cleanup_not_pending');
  const oldArray = job.fields['oldPublicIds']?.arrayValue;
  const currentArray = job.fields['newPublicIds']?.arrayValue;
  const old = oldArray ? (oldArray.values ?? []).map(item => item.stringValue) : null;
  const current = currentArray ? (currentArray.values ?? []).map(item => item.stringValue) : null;
  const valid = (id: unknown): id is string => typeof id === 'string' && id.startsWith(`ourfinance-test/${groupId}/`) &&
    /^ourfinance-test\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/(?:restore_[0-9a-f-]+\/)?[A-Za-z0-9_-]+$/i.test(id);
  if (!Array.isArray(old) || !Array.isArray(current) || old.length > 1000 || old.some(id => !valid(id)) || current.some(id => !valid(id)) ||
      old.some(id => current.includes(id))) throw new RestoreCleanupError(503, 'invalid_cleanup_journal');
  for (const publicId of old) await destroyAuthenticated(publicId!, env, transport);
  const response = await transport(`https://firestore.googleapis.com/v1/${root}/groups/${groupId}/restoreJobs/${restoreId}?updateMask.fieldPaths=status&updateMask.fieldPaths=completedAt`, {
    method: 'PATCH', headers, body: JSON.stringify({ fields: { status: { stringValue: 'completed' }, completedAt: { timestampValue: new Date().toISOString() } } }),
  });
  if (!response.ok) throw new RestoreCleanupError(503, 'cleanup_state_unavailable');
  return old.length;
}
