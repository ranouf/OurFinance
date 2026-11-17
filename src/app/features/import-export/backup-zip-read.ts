import { verifyBackupPackageV1, type BackupManifestV1, type BackupPackageV1 } from './backup-package';
import { verifyBackupPackageV2, type BackupManifestV2, type BackupPackageV2 } from './backup-package-v2';
import { crc32 } from './backup-zip';

const decoder = new TextDecoder('utf-8', { fatal: true });
const validName = (name: string) => name === 'manifest.json' || name === 'group.json' ||
  /^[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\.(png|jpg)$/.test(name);

/** Reads only the bounded, uncompressed ZIP subset emitted by our encoder. */
function readStoredBackupZip(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.byteLength < 22 || bytes.byteLength > 60_000_000) throw new Error('Archive ZIP invalide ou trop volumineuse');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.byteLength - 22;
  if (view.getUint32(end, true) !== 0x06054b50 || view.getUint16(end + 20, true) !== 0 ||
      view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) throw new Error('Fin de ZIP invalide');
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralStart = view.getUint32(end + 16, true);
  if (count < 2 || count > 102 || count !== view.getUint16(end + 8, true) || centralStart + centralSize !== end) throw new Error('Index ZIP invalide');
  const files = new Map<string, Uint8Array>();
  let position = centralStart;
  for (let index = 0; index < count; index++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50 ||
        view.getUint16(position + 8, true) !== 0x0800 || view.getUint16(position + 10, true) !== 0 ||
        view.getUint16(position + 12, true) !== 0 || view.getUint16(position + 30, true) !== 0 ||
        view.getUint16(position + 32, true) !== 0) throw new Error('Entrée ZIP non prise en charge');
    const expectedCrc = view.getUint32(position + 16, true);
    const size = view.getUint32(position + 20, true);
    const nameLength = view.getUint16(position + 28, true);
    const local = view.getUint32(position + 42, true);
    if (size !== view.getUint32(position + 24, true) || position + 46 + nameLength > end || local + 30 > centralStart) throw new Error('Taille ZIP invalide');
    const name = decoder.decode(bytes.subarray(position + 46, position + 46 + nameLength));
    if (!validName(name) || files.has(name) || view.getUint32(local, true) !== 0x04034b50 ||
        view.getUint16(local + 6, true) !== 0x0800 || view.getUint16(local + 8, true) !== 0 ||
        view.getUint16(local + 26, true) !== nameLength || view.getUint16(local + 28, true) !== 0 ||
        view.getUint32(local + 14, true) !== expectedCrc || view.getUint32(local + 18, true) !== size ||
        view.getUint32(local + 22, true) !== size ||
        decoder.decode(bytes.subarray(local + 30, local + 30 + nameLength)) !== name) throw new Error('Fichier ZIP invalide');
    const dataStart = local + 30 + nameLength;
    if (dataStart + size > centralStart) throw new Error('Données ZIP incomplètes');
    const data = bytes.slice(dataStart, dataStart + size);
    if (crc32(data) !== expectedCrc) throw new Error('CRC ZIP invalide');
    files.set(name, data);
    position += 46 + nameLength;
  }
  if (position !== end || !files.has('manifest.json') || !files.has('group.json')) throw new Error('ZIP incomplet');
  return files;
}

export async function decodeBackupZipV1(bytes: Uint8Array): Promise<BackupPackageV1> {
  const files = readStoredBackupZip(bytes);
  const manifest = JSON.parse(decoder.decode(files.get('manifest.json'))) as BackupManifestV1;
  const groupJson = decoder.decode(files.get('group.json'));
  if (!Array.isArray(manifest.receipts) || files.size !== manifest.receipts.length + 2) throw new Error('Manifeste ZIP incomplet');
  const receipts = manifest.receipts.map(item => {
    const data = files.get(item.filename);
    if (!data) throw new Error('Reçu absent du ZIP');
    return { filename: item.filename, contentType: item.contentType, byteLength: data.byteLength, sha256: item.sha256, bytes: data };
  });
  const result: BackupPackageV1 = { manifest, groupJson, receipts };
  await verifyBackupPackageV1(result);
  return result;
}

export async function decodeBackupZipV2(bytes: Uint8Array): Promise<BackupPackageV2> {
  const files = readStoredBackupZip(bytes);
  const manifest = JSON.parse(decoder.decode(files.get('manifest.json'))) as BackupManifestV2;
  const groupJson = decoder.decode(files.get('group.json'));
  if (!Array.isArray(manifest.receipts) || files.size !== manifest.receipts.length + 2) throw new Error('Manifeste ZIP incomplet');
  const receipts = manifest.receipts.map(item => {
    const data = files.get(item.filename);
    if (!data) throw new Error('Reçu absent du ZIP');
    return { filename: item.filename, contentType: item.contentType, byteLength: data.byteLength, sha256: item.sha256, bytes: data };
  });
  const result: BackupPackageV2 = { manifest, groupJson, receipts };
  await verifyBackupPackageV2(result);
  return result;
}
