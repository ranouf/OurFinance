import type { GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { serviceAccessToken } from './service-account';
import type { LiveRestoreInventory } from './restore-inventory';
import type { StagedRestoreReceipt } from './restore-media';
import { buildRestoreWrites } from './restore-writes';

export interface RestoreCommitEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string }
export class RestoreCommitError extends Error {
  constructor(readonly status: 403 | 409 | 503, readonly code: string) { super(code); }
}

/** Final atomic swap. Group must already be locked; no external media cleanup occurs in this transaction. */
export async function commitGroupRestoreV2(
  uid: string, groupId: string, restoreId: string, backup: GroupExportV2, live: LiveRestoreInventory,
  staged: readonly StagedRestoreReceipt[], env: RestoreCommitEnv, transport: typeof fetch = fetch,
): Promise<readonly string[]> {
  const plan = buildRestoreWrites(backup, live, staged, env.FIREBASE_PROJECT_ID, new Date().toISOString());
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
    const groupFields = group?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    if (groupFields?.['status']?.stringValue !== 'restoring' || groupFields['restoreId']?.stringValue !== restoreId ||
        groupFields['restoreOwnerId']?.stringValue !== uid || groupFields['ownerId']?.stringValue !== uid ||
        (groupFields['currencyCode']?.stringValue ?? groupFields['currency']?.stringValue) !== backup.group.currency) {
      throw new RestoreCommitError(409, 'group_changed');
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
