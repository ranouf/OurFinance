import type { User } from 'firebase/auth';
import { sha256Hex, type BackupManifestV1 } from './backup-package';
import { collectGroupExportV2 } from './export-collector-v2';
import type { ExportReader } from './export-collector';
import { serializeGroupExportV2, type GroupExportV2 } from './export-v2';
import { downloadReceiptForExport, type ExportedReceipt } from './receipt-export';

export interface BackupManifestV2 extends Omit<BackupManifestV1, 'version' | 'scope'> {
  readonly version: 2;
  readonly scope: 'group-v2-partial';
}
export interface BackupPackageV2 {
  readonly manifest: BackupManifestV2;
  readonly groupJson: string;
  readonly receipts: readonly ExportedReceipt[];
}

/** Adds member preferences to the verified private-receipt package. */
export async function buildBackupPackageV2(
  reader: ExportReader,
  user: Pick<User, 'uid' | 'emailVerified' | 'getIdToken'>,
  groupId: string,
  workerUrl: string,
  transport: typeof fetch = fetch,
): Promise<BackupPackageV2> {
  const groupJson = await collectGroupExportV2(reader, user, groupId, workerUrl, transport);
  const group = JSON.parse(groupJson) as GroupExportV2;
  const active = group.receipts.filter(row => row.status === 'active');
  const groupBytes = new TextEncoder().encode(groupJson);
  if (groupBytes.byteLength > 10_000_000 || active.length > 25) throw new Error('Lot de sauvegarde trop volumineux');
  const receipts: ExportedReceipt[] = [];
  for (const row of active) receipts.push(await downloadReceiptForExport(user, workerUrl, groupId, row.expenseId, row.attachmentId, row.format, transport));
  if ((await reader.read(`groups/${groupId}/members/${user.uid}`))?.data['status'] !== 'active') throw new Error('Membre révoqué pendant la sauvegarde');
  const manifest: BackupManifestV2 = {
    format: 'OurFinanceBackupManifest', version: 2, scope: 'group-v2-partial', groupId, exportedAt: group.exportedAt,
    groupJson: { filename: 'group.json', sha256: await sha256Hex(groupBytes), byteLength: groupBytes.byteLength },
    receipts: active.map((row, index) => ({
      expenseId: row.expenseId, attachmentId: row.attachmentId, filename: receipts[index].filename,
      sha256: receipts[index].sha256, byteLength: receipts[index].byteLength, contentType: receipts[index].contentType,
    })),
  };
  return { manifest, groupJson, receipts };
}

export async function verifyBackupPackageV2(value: BackupPackageV2): Promise<void> {
  const { manifest, groupJson, receipts } = value;
  if (manifest.format !== 'OurFinanceBackupManifest' || manifest.version !== 2 || manifest.scope !== 'group-v2-partial' ||
      manifest.groupJson.filename !== 'group.json' || manifest.receipts.length !== receipts.length) throw new Error('Manifeste V2 invalide');
  const bytes = new TextEncoder().encode(groupJson);
  if (bytes.byteLength !== manifest.groupJson.byteLength || await sha256Hex(bytes) !== manifest.groupJson.sha256) throw new Error('Intégrité du groupe invalide');
  const group = JSON.parse(groupJson) as GroupExportV2;
  serializeGroupExportV2(group);
  if (group.group.id !== manifest.groupId || group.exportedAt !== manifest.exportedAt) throw new Error('Groupe du manifeste invalide');
  const active = group.receipts.filter(row => row.status === 'active');
  if (active.length !== receipts.length) throw new Error('Reçus incomplets');
  for (let index = 0; index < active.length; index++) {
    const row = active[index], meta = manifest.receipts[index], file = receipts[index];
    const filename = `${group.group.id}/${row.expenseId}/${row.attachmentId}.${row.format}`;
    const contentType = row.format === 'png' ? 'image/png' : 'image/jpeg';
    if (meta.expenseId !== row.expenseId || meta.attachmentId !== row.attachmentId ||
        meta.filename !== filename || file.filename !== filename || meta.contentType !== contentType || file.contentType !== contentType ||
        meta.byteLength !== file.bytes.byteLength || file.byteLength !== file.bytes.byteLength || meta.sha256 !== file.sha256 ||
        await sha256Hex(file.bytes) !== meta.sha256) throw new Error('Intégrité du reçu invalide');
  }
}
