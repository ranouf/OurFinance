import { verifyBackupPackageV1, type BackupPackageV1 } from './backup-package';
import type { ExportedReceipt } from './receipt-export';

const encoder = new TextEncoder();
const signature = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50 };
const crcTable = Uint32Array.from({ length: 256 }, (_, start) => {
  let value = start;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});
export function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
interface FileEntry { readonly name: string; readonly nameBytes: Uint8Array; readonly bytes: Uint8Array; readonly crc: number; offset: number }

/** Portable uncompressed ZIP; caller must keep the resulting partial backup private. */
export async function encodeBackupZipV1(value: BackupPackageV1): Promise<Uint8Array> {
  await verifyBackupPackageV1(value);
  return encodeBackupZipFiles(value.manifest, value.groupJson, value.receipts);
}

/** Shared byte encoder; callers must verify their versioned package first. */
export function encodeBackupZipFiles(manifest: object, groupJson: string, receipts: readonly ExportedReceipt[]): Uint8Array {
  const files = [
    { name: 'manifest.json', bytes: encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`) },
    { name: 'group.json', bytes: encoder.encode(groupJson) },
    ...receipts.map(receipt => ({ name: receipt.filename, bytes: receipt.bytes })),
  ];
  if (files.length > 27 || files.some(file => file.name.includes('..') || file.name.startsWith('/') || file.name.includes('\\'))) {
    throw new Error('Fichiers de sauvegarde invalides');
  }
  const entries: FileEntry[] = files.map(file => ({ ...file, nameBytes: encoder.encode(file.name), crc: crc32(file.bytes), offset: 0 }));
  if (entries.some(file => file.nameBytes.byteLength > 65535 || file.bytes.byteLength > 0xffffffff)) throw new Error('Fichier ZIP trop volumineux');
  const localLength = entries.reduce((length, file) => length + 30 + file.nameBytes.byteLength + file.bytes.byteLength, 0);
  const centralLength = entries.reduce((length, file) => length + 46 + file.nameBytes.byteLength, 0);
  if (localLength + centralLength + 22 > 60_000_000) throw new Error('Archive ZIP trop volumineuse');
  const bytes = new Uint8Array(localLength + centralLength + 22);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  for (const file of entries) {
    file.offset = offset;
    view.setUint32(offset, signature.local, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 names.
    view.setUint16(offset + 8, 0, true); // Store without compression.
    view.setUint32(offset + 14, file.crc, true);
    view.setUint32(offset + 18, file.bytes.byteLength, true);
    view.setUint32(offset + 22, file.bytes.byteLength, true);
    view.setUint16(offset + 26, file.nameBytes.byteLength, true);
    bytes.set(file.nameBytes, offset + 30);
    bytes.set(file.bytes, offset + 30 + file.nameBytes.byteLength);
    offset += 30 + file.nameBytes.byteLength + file.bytes.byteLength;
  }
  const centralStart = offset;
  for (const file of entries) {
    view.setUint32(offset, signature.central, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint32(offset + 16, file.crc, true);
    view.setUint32(offset + 20, file.bytes.byteLength, true);
    view.setUint32(offset + 24, file.bytes.byteLength, true);
    view.setUint16(offset + 28, file.nameBytes.byteLength, true);
    view.setUint32(offset + 42, file.offset, true);
    bytes.set(file.nameBytes, offset + 46);
    offset += 46 + file.nameBytes.byteLength;
  }
  view.setUint32(offset, signature.end, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, centralLength, true);
  view.setUint32(offset + 16, centralStart, true);
  return bytes;
}
