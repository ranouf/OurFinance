import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { encodeBackupZipV1 } from '../../src/app/features/import-export/backup-zip';
import type { BackupPackageV1 } from '../../src/app/features/import-export/backup-package';
import { serializeGroupExportV1, type GroupExportV1 } from '../../src/app/features/import-export/export-v1';

const group: GroupExportV1 = {
  format: 'OurFinanceGroupExport', version: 1, exportedAt: '2026-11-16T18:00:00.000Z',
  group: { id: 'group_test', name: 'Fictif', currency: 'CAD' },
  members: [{ userId: 'member_a', role: 'owner', status: 'active' }],
  expenses: [{ id: 'expense_1', date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 100, categoryId: 'other', categoryLabel: 'Autre', categoryIcon: 'circle', categoryColor: 'slate', payments: [{ userId: 'member_a', amountMinor: 100 }], allocations: [{ userId: 'member_a', amountMinor: 100 }], splitSnapshotJson: '{"kind":"equal"}', deleted: false }],
  settlements: [], importedRecords: [], categories: [],
  receipts: [{ expenseId: 'expense_1', attachmentId: 'receipt_1', format: 'png', status: 'active', mediaIncluded: false }],
};
const hash = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
async function fixture(): Promise<BackupPackageV1> {
  const groupJson = serializeGroupExportV1(group);
  const groupBytes = new TextEncoder().encode(groupJson);
  const bytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==', 'base64'));
  const filename = 'group_test/expense_1/receipt_1.png';
  const sha256 = await hash(bytes);
  return {
    groupJson,
    receipts: [{ filename, contentType: 'image/png', byteLength: bytes.byteLength, sha256, bytes }],
    manifest: { format: 'OurFinanceBackupManifest', version: 1, groupId: 'group_test', exportedAt: group.exportedAt,
      groupJson: { filename: 'group.json', sha256: await hash(groupBytes), byteLength: groupBytes.byteLength },
      receipts: [{ expenseId: 'expense_1', attachmentId: 'receipt_1', filename, sha256, byteLength: bytes.byteLength, contentType: 'image/png' }], scope: 'group-v1-partial' },
  };
}

test('writes a ZIP with manifest, group and private receipt entries', async () => {
  const zip = await encodeBackupZipV1(await fixture());
  const view = new DataView(zip.buffer);
  strictEqual(view.getUint32(0, true), 0x04034b50);
  strictEqual(view.getUint32(zip.length - 22, true), 0x06054b50);
  strictEqual(view.getUint16(zip.length - 12, true), 3);
  const text = new TextDecoder().decode(zip);
  strictEqual(text.includes('manifest.json'), true);
  strictEqual(text.includes('group.json'), true);
  strictEqual(text.includes('group_test/expense_1/receipt_1.png'), true);
  strictEqual(text.includes('group-v1-partial'), true);
});

test('refuses a corrupted receipt before encoding', async () => {
  const original = await fixture();
  const changed = { ...original, receipts: [{ ...original.receipts[0], bytes: Uint8Array.from(original.receipts[0].bytes) }] };
  changed.receipts[0].bytes[20] ^= 1;
  await rejects(encodeBackupZipV1(changed), /Intégrité/);
});
