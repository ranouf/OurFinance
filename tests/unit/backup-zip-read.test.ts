import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { encodeBackupZipV1 } from '../../src/app/features/import-export/backup-zip';
import { decodeBackupZipV1 } from '../../src/app/features/import-export/backup-zip-read';
import type { BackupPackageV1 } from '../../src/app/features/import-export/backup-package';
import { serializeGroupExportV1 } from '../../src/app/features/import-export/export-v1';

const hash = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
async function fixture(): Promise<BackupPackageV1> {
  const exportedAt = '2026-11-16T18:00:00.000Z';
  const groupJson = serializeGroupExportV1({ format: 'OurFinanceGroupExport', version: 1, exportedAt,
    group: { id: 'group_test', name: 'Fictif', currency: 'CAD' }, members: [{ userId: 'member_a', role: 'owner', status: 'active' }],
    expenses: [{ id: 'expense_1', date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 100,
      categoryId: 'other', categoryLabel: 'Autre', categoryIcon: 'circle', categoryColor: 'slate',
      payments: [{ userId: 'member_a', amountMinor: 100 }], allocations: [{ userId: 'member_a', amountMinor: 100 }], splitSnapshotJson: '{"kind":"equal"}', deleted: false }],
    settlements: [], importedRecords: [], categories: [],
    receipts: [{ expenseId: 'expense_1', attachmentId: 'receipt_1', format: 'png', status: 'active', mediaIncluded: false }],
  });
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==', 'base64'));
  const filename = 'group_test/expense_1/receipt_1.png';
  const sha256 = await hash(png);
  const groupBytes = new TextEncoder().encode(groupJson);
  return { groupJson, receipts: [{ filename, sha256, byteLength: png.length, contentType: 'image/png', bytes: png }],
    manifest: { format: 'OurFinanceBackupManifest', version: 1, groupId: 'group_test', exportedAt,
      groupJson: { filename: 'group.json', sha256: await hash(groupBytes), byteLength: groupBytes.length },
      receipts: [{ expenseId: 'expense_1', attachmentId: 'receipt_1', filename, sha256, byteLength: png.length, contentType: 'image/png' }], scope: 'group-v1-partial' } };
}

test('reads a ZIP with group JSON and private PNG, then verifies the manifest', async () => {
  const original = await fixture();
  const zip = await encodeBackupZipV1(original);
  const decoded = await decodeBackupZipV1(zip);
  strictEqual(decoded.groupJson, original.groupJson);
  strictEqual(decoded.receipts[0].sha256, original.receipts[0].sha256);
  strictEqual(decoded.receipts[0].bytes.length, original.receipts[0].bytes.length);
});

test('refuses corrupted ZIP bytes, trailing comments and truncated archives', async () => {
  const zip = await encodeBackupZipV1(await fixture());
  const tampered = Uint8Array.from(zip);
  tampered[100] ^= 1;
  await rejects(decodeBackupZipV1(tampered));
  await rejects(decodeBackupZipV1(zip.subarray(0, zip.length - 1)));
  const comment = new Uint8Array(zip.length + 1); comment.set(zip);
  await rejects(decodeBackupZipV1(comment));
});

test('rejects unsupported ZIP metadata before exposing archived documents', async () => {
  const zip = await encodeBackupZipV1(await fixture());
  const end = zip.length - 22;
  const source = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const centralStart = source.getUint32(end + 16, true);
  const cases: readonly [number, number, number][] = [
    [end + 4, 2, 1], // split archive
    [end + 10, 2, 1], // incomplete central file count
    [centralStart, 4, 0], // central directory signature
    [centralStart + 10, 2, 8], // compressed entry
    [centralStart + 12, 2, 8], // encrypted/unsupported entry
    [centralStart + 20, 4, 1], // length differs from local record
  ];
  for (const [offset, width, value] of cases) {
    const changed = Uint8Array.from(zip);
    const view = new DataView(changed.buffer);
    if (width === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
    await rejects(decodeBackupZipV1(changed));
  }
});
