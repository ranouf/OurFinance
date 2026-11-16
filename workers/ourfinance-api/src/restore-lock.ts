import { serviceAccessToken } from './service-account';

export interface RestoreLockEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string }
export class RestoreLockError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function changeLock(uid: string, groupId: string, restoreId: string, currency: string | null, env: RestoreLockEnv, transport: typeof fetch): Promise<void> {
  if (!idPattern.test(uid) || !idPattern.test(groupId) || !uuidPattern.test(restoreId)) throw new RestoreLockError(400, 'invalid_restore');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const checked = async (response: Response) => {
    if (!response.ok) throw new RestoreLockError(response.status === 409 ? 409 : 503, 'firestore_unavailable');
    return await response.json() as Record<string, unknown>;
  };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new RestoreLockError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      return response.status === 404 ? null : await checked(response);
    };
    const group = await read(`groups/${groupId}`);
    const member = await read(`groups/${groupId}/members/${uid}`);
    const groupFields = group?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    const memberFields = member?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    if (memberFields?.['status']?.stringValue !== 'active' || memberFields['role']?.stringValue !== 'owner') throw new RestoreLockError(403, 'owner_required');
    if (currency !== null) {
      if (groupFields?.['status']?.stringValue !== 'active' || groupFields['restoreId'] ||
          (groupFields['currencyCode']?.stringValue ?? groupFields['currency']?.stringValue) !== currency) throw new RestoreLockError(409, 'group_changed');
    } else if (groupFields?.['status']?.stringValue !== 'restoring' || groupFields['restoreId']?.stringValue !== restoreId ||
        groupFields['restoreOwnerId']?.stringValue !== uid) throw new RestoreLockError(409, 'restore_not_owned');
    const fields = currency !== null
      ? { status: { stringValue: 'restoring' }, restoreId: { stringValue: restoreId }, restoreOwnerId: { stringValue: uid }, restoringAt: { timestampValue: new Date().toISOString() } }
      : { status: { stringValue: 'active' } };
    const updateMask = currency !== null ? Object.keys(fields) : ['status', 'restoreId', 'restoreOwnerId', 'restoringAt'];
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({
      transaction, writes: [{ update: { name: `${root}/groups/${groupId}`, fields }, updateMask: { fieldPaths: updateMask } }],
    }) }));
    committed = true;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}

export async function beginRestoreLock(uid: string, groupId: string, restoreId: string, currency: string, env: RestoreLockEnv, transport: typeof fetch = fetch): Promise<void> {
  if (!Intl.supportedValuesOf('currency').includes(currency)) throw new RestoreLockError(400, 'invalid_currency');
  await changeLock(uid, groupId, restoreId, currency, env, transport);
}

/** Abort is safe only before the replacement commit; it leaves old group documents intact. */
export async function abortRestoreLock(uid: string, groupId: string, restoreId: string, env: RestoreLockEnv, transport: typeof fetch = fetch): Promise<void> {
  await changeLock(uid, groupId, restoreId, null, env, transport);
}
