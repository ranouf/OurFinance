import type { User } from 'firebase/auth';
import { collectGroupExportV1, type ExportReader } from './export-collector';
import { validateGroupExportV1, type GroupExportV1 } from './export-v1';
import { downloadReceiptForExport, type ExportedReceipt } from './receipt-export';

export interface BackupManifestV1 {
  readonly format: 'OurFinanceBackupManifest';
  readonly version: 1;
  readonly groupId: string;
  readonly exportedAt: string;
  readonly groupJson: { readonly filename: 'group.json'; readonly sha256: string; readonly byteLength: number };
  readonly receipts: readonly { readonly expenseId: string; readonly attachmentId: string; readonly filename: string; readonly sha256: string; readonly byteLength: number; readonly contentType: 'image/png' | 'image/jpeg' }[];
  /** This only covers the collections represented by GroupExportV1. */
  readonly scope: 'group-v1-partial';
}
export interface BackupPackageV1 {
  readonly manifest: BackupManifestV1;
  readonly groupJson: string;
  readonly receipts: readonly ExportedReceipt[];
}
const digest = async (bytes: Uint8Array): Promise<string> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/** All-or-nothing in memory: no package is returned if one active receipt fails. */
export async function buildBackupPackageV1(
  reader: ExportReader,
  user: Pick<User, 'uid' | 'emailVerified' | 'getIdToken'>,
  groupId: string,
  workerUrl: string,
  transport: typeof fetch = fetch,
): Promise<BackupPackageV1> {
  const groupJson = await collectGroupExportV1(reader, user, groupId);
  const group = JSON.parse(groupJson) as GroupExportV1;
  const active = group.receipts.filter(row => row.status === 'active');
  if (new TextEncoder().encode(groupJson).byteLength > 10_000_000 || active.length > 25) {
    throw new Error('Lot de sauvegarde trop volumineux');
  }
  const receipts: ExportedReceipt[] = [];
  for (const row of active) {
    receipts.push(await downloadReceiptForExport(user, workerUrl, groupId, row.expenseId, row.attachmentId, row.format === 'png' ? 'png' : 'jpg', transport));
  }
  if ((await reader.read(`groups/${groupId}/members/${user.uid}`))?.data['status'] !== 'active') {
    throw new Error('Membre révoqué pendant l’export des reçus');
  }
  const groupBytes = new TextEncoder().encode(groupJson);
  const manifest: BackupManifestV1 = {
    format: 'OurFinanceBackupManifest', version: 1, groupId, exportedAt: group.exportedAt,
    groupJson: { filename: 'group.json', sha256: await digest(groupBytes), byteLength: groupBytes.byteLength },
    receipts: active.map((row, index) => ({
      expenseId: row.expenseId, attachmentId: row.attachmentId, filename: receipts[index].filename,
      sha256: receipts[index].sha256, byteLength: receipts[index].byteLength, contentType: receipts[index].contentType,
    })),
    scope: 'group-v1-partial',
  };
  return { manifest, groupJson, receipts };
}

/** Verifies in-memory files before any restore code may consume them. */
export async function verifyBackupPackageV1(value: BackupPackageV1): Promise<void> {
  if (value.manifest.format !== 'OurFinanceBackupManifest' || value.manifest.version !== 1 || value.manifest.scope !== 'group-v1-partial' ||
      value.manifest.groupJson.filename !== 'group.json' || value.manifest.receipts.length !== value.receipts.length) throw new Error('Manifeste de sauvegarde invalide');
  const groupBytes = new TextEncoder().encode(value.groupJson);
  if (groupBytes.byteLength !== value.manifest.groupJson.byteLength || await digest(groupBytes) !== value.manifest.groupJson.sha256) throw new Error('Intégrité du groupe invalide');
  const group = JSON.parse(value.groupJson) as GroupExportV1;
  validateGroupExportV1(group);
  if (group.group.id !== value.manifest.groupId || group.exportedAt !== value.manifest.exportedAt) throw new Error('Groupe du manifeste invalide');
  const expected = group.receipts.filter(row => row.status === 'active');
  if (expected.length !== value.receipts.length) throw new Error('Reçus incomplets');
  for (let index = 0; index < expected.length; index++) {
    const meta = value.manifest.receipts[index], file = value.receipts[index], row = expected[index];
    const expectedName = `${group.group.id}/${row.expenseId}/${row.attachmentId}.${row.format}`;
    const expectedType = row.format === 'png' ? 'image/png' : 'image/jpeg';
    if (meta.expenseId !== row.expenseId || meta.attachmentId !== row.attachmentId ||
        meta.filename !== expectedName || file.filename !== expectedName || meta.byteLength !== file.bytes.byteLength ||
        meta.contentType !== expectedType || file.contentType !== expectedType ||
        meta.sha256 !== file.sha256 || await digest(file.bytes) !== meta.sha256) throw new Error('Intégrité du reçu invalide');
  }
}
