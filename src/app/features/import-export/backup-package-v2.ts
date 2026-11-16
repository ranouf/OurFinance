import type { User } from 'firebase/auth';
import { collectGroupExportV2 } from './export-collector-v2';
import type { ExportReader } from './export-collector';
import { validateGroupExportV2, type GroupExportV2 } from './export-v2';
import { downloadReceiptForExport, type ExportedReceipt } from './receipt-export';

export interface BackupManifestV2 {
  readonly format: 'OurFinanceBackupManifest';
  readonly version: 2;
  readonly groupId: string;
  readonly exportedAt: string;
  readonly groupJson: { readonly filename: 'group.json'; readonly sha256: string; readonly byteLength: number };
  readonly receipts: readonly { readonly expenseId: string; readonly attachmentId: string; readonly filename: string; readonly sha256: string; readonly byteLength: number; readonly contentType: 'image/png' | 'image/jpeg' }[];
  readonly scope: 'group-v2-partial';
}
export interface BackupPackageV2 {
  readonly manifest: BackupManifestV2;
  readonly groupJson: string;
  readonly receipts: readonly ExportedReceipt[];
}
const digest = async (bytes: Uint8Array): Promise<string> => {
  const copy = new Uint8Array(bytes.byteLength); copy.set(bytes);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', copy))].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/** No package is returned unless every active private receipt was fetched. */
export async function buildBackupPackageV2(reader: ExportReader, user: Pick<User, 'uid' | 'emailVerified' | 'getIdToken'>,
  groupId: string, workerUrl: string, transport: typeof fetch = fetch): Promise<BackupPackageV2> {
  const groupJson = await collectGroupExportV2(reader, user, groupId);
  const group = JSON.parse(groupJson) as GroupExportV2;
  const active = group.receipts.filter(row => row.status === 'active');
  if (new TextEncoder().encode(groupJson).byteLength > 10_000_000 || active.length > 25) throw new Error('Lot de sauvegarde trop volumineux');
  const receipts: ExportedReceipt[] = [];
  for (const row of active) receipts.push(await downloadReceiptForExport(user, workerUrl, groupId, row.expenseId, row.attachmentId, row.format, transport));
  if ((await reader.read(`groups/${groupId}/members/${user.uid}`))?.data['status'] !== 'active') throw new Error('Membre révoqué pendant l’export des reçus');
  const bytes = new TextEncoder().encode(groupJson);
  const manifest: BackupManifestV2 = {
    format: 'OurFinanceBackupManifest', version: 2, groupId, exportedAt: group.exportedAt,
    groupJson: { filename: 'group.json', sha256: await digest(bytes), byteLength: bytes.byteLength },
    receipts: active.map((row, index) => ({ expenseId: row.expenseId, attachmentId: row.attachmentId,
      filename: receipts[index].filename, sha256: receipts[index].sha256, byteLength: receipts[index].byteLength,
      contentType: receipts[index].contentType })),
    scope: 'group-v2-partial',
  };
  return { manifest, groupJson, receipts };
}

/** Validates every byte and metadata link before a V2 archive is accepted. */
export async function verifyBackupPackageV2(value: BackupPackageV2): Promise<void> {
  if (value.manifest.format !== 'OurFinanceBackupManifest' || value.manifest.version !== 2 || value.manifest.scope !== 'group-v2-partial' ||
      value.manifest.groupJson.filename !== 'group.json' || value.manifest.receipts.length !== value.receipts.length) throw new Error('Manifeste V2 invalide');
  const bytes = new TextEncoder().encode(value.groupJson);
  if (bytes.byteLength !== value.manifest.groupJson.byteLength || await digest(bytes) !== value.manifest.groupJson.sha256) throw new Error('Intégrité du JSON V2 invalide');
  const group = JSON.parse(value.groupJson) as GroupExportV2;
  validateGroupExportV2(group);
  if (group.group.id !== value.manifest.groupId || group.exportedAt !== value.manifest.exportedAt) throw new Error('Groupe V2 du manifeste invalide');
  const expected = group.receipts.filter(row => row.status === 'active');
  if (expected.length !== value.receipts.length) throw new Error('Reçus V2 incomplets');
  for (let index = 0; index < expected.length; index++) {
    const row = expected[index], meta = value.manifest.receipts[index], file = value.receipts[index];
    const filename = `${group.group.id}/${row.expenseId}/${row.attachmentId}.${row.format}`;
    const contentType = row.format === 'png' ? 'image/png' : 'image/jpeg';
    if (meta.expenseId !== row.expenseId || meta.attachmentId !== row.attachmentId ||
        meta.filename !== filename || file.filename !== filename || meta.byteLength !== file.bytes.byteLength ||
        meta.contentType !== contentType || file.contentType !== contentType || meta.sha256 !== file.sha256 ||
        await digest(file.bytes) !== meta.sha256) throw new Error('Intégrité du reçu V2 invalide');
  }
}
