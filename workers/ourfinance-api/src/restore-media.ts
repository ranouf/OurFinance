import { destroyAuthenticated, imageFormat, uploadAuthenticated, type CloudinaryEnv } from './cloudinary';

export interface RestoreReceiptBytes {
  readonly expenseId: string;
  readonly attachmentId: string;
  readonly format: 'jpg' | 'png';
  readonly bytes: Uint8Array;
}
export interface StagedRestoreReceipt {
  readonly expenseId: string;
  readonly attachmentId: string;
  readonly publicId: string;
  readonly format: 'jpg' | 'png';
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Called only after archive verification and owner authorization by the restore route. */
export async function stageRestoreReceipts(groupId: string, restoreId: string, receipts: readonly RestoreReceiptBytes[], env: CloudinaryEnv & { readonly FIREBASE_PROJECT_ID: string }, transport: typeof fetch = fetch): Promise<StagedRestoreReceipt[]> {
  if (!idPattern.test(groupId) || !uuidPattern.test(restoreId) || receipts.length > 25) throw new Error('Lot de reçus invalide');
  const staged: StagedRestoreReceipt[] = [];
  const seen = new Set<string>();
  try {
    for (const row of receipts) {
      const key = `${row.expenseId}/${row.attachmentId}`;
      if (!idPattern.test(row.expenseId) || !idPattern.test(row.attachmentId) || seen.has(key) ||
          imageFormat(row.bytes, row.format === 'png' ? 'image/png' : 'image/jpeg') !== row.format) throw new Error('Reçu de restauration invalide');
      seen.add(key);
      const publicId = `${env.FIREBASE_PROJECT_ID}/${groupId}/${row.expenseId}/restore_${restoreId}/${row.attachmentId}`;
      try { await uploadAuthenticated(row.bytes, row.format, publicId, env, transport); }
      catch (error) {
        await destroyAuthenticated(publicId, env, transport);
        throw error;
      }
      staged.push({ expenseId: row.expenseId, attachmentId: row.attachmentId, publicId, format: row.format });
    }
    return staged;
  } catch (error) {
    const cleanup = await Promise.allSettled(staged.map(row => destroyAuthenticated(row.publicId, env, transport)));
    if (cleanup.some(result => result.status === 'rejected')) throw new Error('Nettoyage des reçus préparés incomplet', { cause: error });
    throw error;
  }
}

export async function removeStagedRestoreReceipts(receipts: readonly StagedRestoreReceipt[], env: CloudinaryEnv, transport: typeof fetch = fetch): Promise<void> {
  const results = await Promise.allSettled(receipts.map(row => destroyAuthenticated(row.publicId, env, transport)));
  if (results.some(result => result.status === 'rejected')) throw new Error('Nettoyage des reçus préparés incomplet');
}
