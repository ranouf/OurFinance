import { verifyBackupPackageV2, type BackupPackageV2 } from './backup-package-v2';
import { readBackupZipFiles } from './backup-zip-read';
import { encodeBackupZipFiles } from './backup-zip';

export async function encodeBackupZipV2(value: BackupPackageV2): Promise<Uint8Array> {
  await verifyBackupPackageV2(value);
  return encodeBackupZipFiles(value.manifest, value.groupJson, value.receipts);
}

export async function decodeBackupZipV2(bytes: Uint8Array): Promise<BackupPackageV2> {
  const value = readBackupZipFiles(bytes) as BackupPackageV2;
  await verifyBackupPackageV2(value);
  return value;
}
