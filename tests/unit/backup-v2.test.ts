import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBackupZipV1 } from '../../src/app/features/import-export/backup-zip-read';
import { decodeBackupZipV2, encodeBackupZipV2 } from '../../src/app/features/import-export/backup-zip-v2';
import { verifyBackupPackageV2, type BackupPackageV2 } from '../../src/app/features/import-export/backup-package-v2';
import { serializeGroupExportV2, type GroupExportV2 } from '../../src/app/features/import-export/export-v2';

const digest = async (bytes: Uint8Array): Promise<string> => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');
const group: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, exportedAt: '2026-11-16T18:00:00.000Z',
  group: { id: 'group_test', name: 'Groupe fictif', currency: 'CAD' },
  members: [{ userId: 'member_a', role: 'owner', status: 'active' }, { userId: 'member_b', role: 'member', status: 'active' }],
  expenses: [{ id: 'expense_1', date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 51,
    categoryId: 'other', categoryLabel: 'Autre', categoryIcon: 'circle', categoryColor: 'slate',
    payments: [{ userId: 'member_a', amountMinor: 51 }], allocations: [{ userId: 'member_b', amountMinor: 51 }],
    splitSnapshotJson: '{"kind":"exact"}', deleted: false }],
  settlements: [], importedRecords: [], categories: [],
  receipts: [{ expenseId: 'expense_1', attachmentId: 'receipt_1', format: 'png', status: 'active', mediaIncluded: false }],
  fxSettlements: [{ id: 'fx_1', date: '2026-11-16', debtCurrency: 'CAD', debtAmountMinor: 51, paymentCurrency: 'JPY',
    paymentAmountMinor: 1, rate: '2', rateDate: '2026-11-16', fromUserId: 'member_b', toUserId: 'member_a', status: 'recorded', deleted: false }],
};
const makePackage = async (): Promise<BackupPackageV2> => {
  const groupJson = serializeGroupExportV2(group);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const filename = 'group_test/expense_1/receipt_1.png';
  const sha256 = await digest(bytes);
  return { groupJson, receipts: [{ filename, contentType: 'image/png', byteLength: bytes.byteLength, sha256, bytes }], manifest: {
    format: 'OurFinanceBackupManifest', version: 2, groupId: 'group_test', exportedAt: group.exportedAt,
    groupJson: { filename: 'group.json', sha256: await digest(new TextEncoder().encode(groupJson)), byteLength: new TextEncoder().encode(groupJson).byteLength },
    receipts: [{ expenseId: 'expense_1', attachmentId: 'receipt_1', filename, sha256, byteLength: bytes.byteLength, contentType: 'image/png' }],
    scope: 'group-v2-partial',
  } };
};

test('V2 ZIP roundtrip preserves FX and private receipt with verified hashes', async () => {
  const value = await makePackage();
  const zip = await encodeBackupZipV2(value);
  const decoded = await decodeBackupZipV2(zip);
  assert.equal((JSON.parse(decoded.groupJson) as GroupExportV2).fxSettlements[0].debtAmountMinor, 51);
  assert.deepEqual(decoded.receipts[0].bytes, value.receipts[0].bytes);
  await assert.rejects(decodeBackupZipV1(zip));
});

test('V2 rejects tampered bytes, missing media and changed FX totals', async () => {
  const value = await makePackage();
  const zip = await encodeBackupZipV2(value);
  const corrupt = zip.slice(); corrupt[100] ^= 1;
  await assert.rejects(decodeBackupZipV2(corrupt));
  await assert.rejects(verifyBackupPackageV2({ ...value, receipts: [] }));
  const altered = value.groupJson.replace('"debtAmountMinor": 51', '"debtAmountMinor": 52');
  await assert.rejects(verifyBackupPackageV2({ ...value, groupJson: altered }));
});
