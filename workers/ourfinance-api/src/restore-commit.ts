import type { GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { serviceAccessToken } from './service-account';
import type { LiveRestoreInventory } from './restore-inventory';
import type { StagedRestoreReceipt } from './restore-media';
import { buildRestoreWrites } from './restore-writes';

export interface RestoreCommitEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string }
export class RestoreCommitError extends Error {
  constructor(readonly status: 403 | 409 | 503, readonly code: string) { super(code); }
}

/** Resolve a lost commit response without guessing whether the group was replaced. */
export async function readRestoreOutcome(uid: string, groupId: string, restoreId: string, env: RestoreCommitEnv, transport: typeof fetch = fetch): Promise<'committed' | 'locked'> {
  if (![uid, groupId].every(id => /^[A-Za-z0-9_-]{1,128}$/.test(id)) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(restoreId)) throw new RestoreCommitError(409, 'invalid_restore');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}` };
  const [groupResponse, memberResponse] = await Promise.all([
    transport(`https://firestore.googleapis.com/v1/${root}/groups/${groupId}`, { headers }),
    transport(`https://firestore.googleapis.com/v1/${root}/groups/${groupId}/members/${uid}`, { headers }),
  ]);
  if (!groupResponse.ok || !memberResponse.ok) throw new RestoreCommitError(503, 'outcome_unavailable');
  const group = await groupResponse.json() as { fields?: Record<string, { stringValue?: string }> };
  const member = await memberResponse.json() as { fields?: Record<string, { stringValue?: string }> };
  if (member.fields?.['role']?.stringValue !== 'owner' || member.fields['status']?.stringValue !== 'active' ||
      group.fields?.['ownerId']?.stringValue !== uid) throw new RestoreCommitError(403, 'owner_required');
  if (group.fields['status']?.stringValue === 'active' && group.fields['lastRestoreId']?.stringValue === restoreId) return 'committed';
  if (group.fields['status']?.stringValue === 'restoring' && group.fields['restoreId']?.stringValue === restoreId &&
      group.fields['restoreOwnerId']?.stringValue === uid) return 'locked';
  throw new RestoreCommitError(409, 'restore_state_changed');
}

/** Final atomic swap. Group must already be locked; no external media cleanup occurs in this transaction. */
export async function commitGroupRestoreV2(
  uid: string, groupId: string, restoreId: string, backup: GroupExportV2, live: LiveRestoreInventory,
  staged: readonly StagedRestoreReceipt[], env: RestoreCommitEnv, transport: typeof fetch = fetch,
): Promise<readonly string[]> {
  const plan = buildRestoreWrites(backup, live, staged, env.FIREBASE_PROJECT_ID, restoreId, new Date().toISOString());
  if (backup.group.id !== groupId || !backup.members.some(row => row.userId === uid && row.role === 'owner' && row.status === 'active')) {
    throw new RestoreCommitError(403, 'owner_required');
  }
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const checked = async (response: Response) => {
    if (!response.ok) throw new RestoreCommitError(response.status === 409 ? 409 : 503, 'firestore_unavailable');
    return await response.json() as Record<string, unknown>;
  };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new RestoreCommitError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      return response.status === 404 ? null : await checked(response);
    };
    const group = await read(`groups/${groupId}`);
    const job = await read(`groups/${groupId}/restoreJobs/${restoreId}`);
    const groupFields = group?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    const jobFields = job?.['fields'] as Record<string, { stringValue?: string; arrayValue?: { values?: { stringValue?: string }[] } }> | undefined;
    if (groupFields?.['status']?.stringValue !== 'restoring' || groupFields['restoreId']?.stringValue !== restoreId ||
        groupFields['restoreOwnerId']?.stringValue !== uid || groupFields['ownerId']?.stringValue !== uid ||
        (groupFields['currencyCode']?.stringValue ?? groupFields['currency']?.stringValue) !== backup.group.currency) {
      throw new RestoreCommitError(409, 'group_changed');
    }
    const expectedAssets = jobFields?.['newPublicIds']?.arrayValue?.values?.map(value => value.stringValue) ?? [];
    if (jobFields?.['ownerId']?.stringValue !== uid || jobFields['status']?.stringValue !== 'staging' ||
        expectedAssets.length !== staged.length || expectedAssets.some((id, index) => id !== staged[index].publicId)) {
      throw new RestoreCommitError(409, 'restore_job_changed');
    }
    const liveMemberPaths = live.groupDocuments.filter(path => path.startsWith(`groups/${groupId}/members/`));
    if (liveMemberPaths.length !== backup.members.length || backup.members.some(row => !liveMemberPaths.includes(`groups/${groupId}/members/${row.userId}`))) {
      throw new RestoreCommitError(409, 'members_changed');
    }
    for (const member of backup.members) {
      const document = await read(`groups/${groupId}/members/${member.userId}`);
      const fields = document?.['fields'] as Record<string, { stringValue?: string }> | undefined;
      if (fields?.['status']?.stringValue !== member.status || fields['role']?.stringValue !== member.role) {
        throw new RestoreCommitError(409, 'members_changed');
      }
    }
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, {
      method: 'POST', headers, body: JSON.stringify({ transaction, writes: plan.writes }),
    }));
    committed = true;
    return plan.previousReceiptPublicIds;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original failure. */ }
    }
  }
}
