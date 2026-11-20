import { readDocumentInTransaction } from './firestore-transaction-read';
import { unavailableCode } from './provider-quota';
import { serviceAccessToken } from './service-account';

export interface RestoreLockEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string }
export class RestoreLockError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shaPattern = /^[0-9a-f]{64}$/;
export interface PreparedRestoreManifest {
  readonly manifestSha256: string;
  readonly receiptSha256: readonly string[];
  readonly receiptFormats: readonly ('jpg' | 'png')[];
}

async function changeLock(uid: string, groupId: string, restoreId: string, currency: string | null, expectedPublicIds: readonly string[], env: RestoreLockEnv, transport: typeof fetch, prepared?: PreparedRestoreManifest): Promise<void> {
  if (!idPattern.test(uid) || !idPattern.test(groupId) || !uuidPattern.test(restoreId)) throw new RestoreLockError(400, 'invalid_restore');
  const expectedPrefix = new RegExp(`^${env.FIREBASE_PROJECT_ID}/${groupId}/[A-Za-z0-9_-]{1,128}/restore_${restoreId}/[A-Za-z0-9_-]{1,128}$`, 'i');
  if (currency !== null && (expectedPublicIds.length > (prepared ? 100 : 25) || new Set(expectedPublicIds).size !== expectedPublicIds.length ||
      expectedPublicIds.some(id => !expectedPrefix.test(id)))) throw new RestoreLockError(400, 'invalid_media');
  if (prepared && (!shaPattern.test(prepared.manifestSha256) || prepared.receiptSha256.length !== expectedPublicIds.length ||
      prepared.receiptFormats.length !== expectedPublicIds.length || prepared.receiptFormats.some(value => value !== 'jpg' && value !== 'png') ||
      prepared.receiptSha256.some(value => !shaPattern.test(value)))) throw new RestoreLockError(400, 'invalid_media');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const checked = async (response: Response) => {
    if (!response.ok) throw new RestoreLockError(response.status === 409 ? 409 : 503, unavailableCode(response, 'firestore_unavailable'));
    return await response.json() as Record<string, unknown>;
  };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new RestoreLockError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await readDocumentInTransaction(root, path, transaction, headers, transport);
      return response.status === 404 ? null : await checked(response);
    };
    const group = await read(`groups/${groupId}`);
    const member = await read(`groups/${groupId}/members/${uid}`);
    const groupFields = group?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    const memberFields = member?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    if (memberFields?.['status']?.stringValue !== 'active' || memberFields['role']?.stringValue !== 'owner') throw new RestoreLockError(403, 'owner_required');
    if (currency !== null) {
      if (groupFields?.['status']?.stringValue !== 'active' || groupFields['restoreId'] || groupFields['pendingCleanupRestoreId'] ||
          (groupFields['currencyCode']?.stringValue ?? groupFields['currency']?.stringValue) !== currency) throw new RestoreLockError(409, 'group_changed');
    } else if (groupFields?.['status']?.stringValue !== 'restoring' || groupFields['restoreId']?.stringValue !== restoreId ||
        groupFields['restoreOwnerId']?.stringValue !== uid) throw new RestoreLockError(409, 'restore_not_owned');
    const jobPath = `groups/${groupId}/restoreJobs/${restoreId}`;
    const job = currency === null ? await read(jobPath) : null;
    const jobFields = job?.['fields'] as Record<string, { stringValue?: string; arrayValue?: { values?: { stringValue?: string }[] } }> | undefined;
    if (currency === null && (jobFields?.['ownerId']?.stringValue !== uid || jobFields['status']?.stringValue !== 'staging')) throw new RestoreLockError(409, 'restore_job_changed');
    const fields = currency !== null
      ? { status: { stringValue: 'restoring' }, restoreId: { stringValue: restoreId }, restoreOwnerId: { stringValue: uid }, restoringAt: { timestampValue: new Date().toISOString() } }
      : { status: { stringValue: 'active' }, pendingCleanupRestoreId: { stringValue: restoreId } };
    const updateMask = currency !== null ? Object.keys(fields) : ['status', 'restoreId', 'restoreOwnerId', 'restoringAt', 'pendingCleanupRestoreId'];
    const string = (value: string) => ({ stringValue: value });
    const jobWrite = currency !== null
      ? { update: { name: `${root}/${jobPath}`, fields: {
        ownerId: string(uid), status: string('staging'), createdAt: { timestampValue: new Date().toISOString() },
        oldPublicIds: { arrayValue: { values: [] } }, newPublicIds: { arrayValue: { values: expectedPublicIds.map(string) } },
        ...(prepared ? {
          manifestSha256: string(prepared.manifestSha256),
          receiptSha256: { arrayValue: { values: prepared.receiptSha256.map(string) } },
          receiptFormats: { arrayValue: { values: prepared.receiptFormats.map(string) } },
          stagedIndices: { arrayValue: { values: [] } },
        } : {}),
      } }, currentDocument: { exists: false } }
      : { update: { name: `${root}/${jobPath}`, fields: {
        status: string('cleanup_pending'), oldPublicIds: { arrayValue: { values: jobFields?.['newPublicIds']?.arrayValue?.values ?? [] } },
        newPublicIds: { arrayValue: { values: [] } },
      } }, updateMask: { fieldPaths: ['status', 'oldPublicIds', 'newPublicIds'] } };
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({
      transaction, writes: [{ update: { name: `${root}/groups/${groupId}`, fields }, updateMask: { fieldPaths: updateMask } }, jobWrite],
    }) }));
    committed = true;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}

export async function beginRestoreLock(uid: string, groupId: string, restoreId: string, currency: string, expectedPublicIds: readonly string[], env: RestoreLockEnv, transport: typeof fetch = fetch): Promise<void> {
  if (!Intl.supportedValuesOf('currency').includes(currency)) throw new RestoreLockError(400, 'invalid_currency');
  await changeLock(uid, groupId, restoreId, currency, expectedPublicIds, env, transport);
}

/** Prepared restore records receipt digests before media is uploaded in separate Worker requests. */
export async function beginPreparedRestoreLock(uid: string, groupId: string, restoreId: string, currency: string,
  expectedPublicIds: readonly string[], manifest: PreparedRestoreManifest, env: RestoreLockEnv, transport: typeof fetch = fetch): Promise<void> {
  if (!Intl.supportedValuesOf('currency').includes(currency)) throw new RestoreLockError(400, 'invalid_currency');
  await changeLock(uid, groupId, restoreId, currency, expectedPublicIds, env, transport, manifest);
}

/** Abort is safe only before the replacement commit; it leaves old group documents intact. */
export async function abortRestoreLock(uid: string, groupId: string, restoreId: string, env: RestoreLockEnv, transport: typeof fetch = fetch): Promise<void> {
  await changeLock(uid, groupId, restoreId, null, [], env, transport);
}
