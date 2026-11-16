import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert';
import { sha256Hex } from '../../src/app/features/import-export/backup-package';
import { verifyBackupPackageV2, type BackupPackageV2 } from '../../src/app/features/import-export/backup-package-v2';
import { encodeBackupZipV2 } from '../../src/app/features/import-export/backup-zip';
import { decodeBackupZipV2 } from '../../src/app/features/import-export/backup-zip-read';
import { serializeGroupExportV2, type GroupExportV2 } from '../../src/app/features/import-export/export-v2';
import { preflightBackupRestoreV2 } from '../../src/app/features/import-export/restore-preflight-v2';
import { compareRestoreInventoryV2, restoreInventoryV2 } from '../../src/app/features/import-export/restore-inventory-v2';

const group: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, snapshotMode: 'server_transaction', exportedAt: '2026-11-16T18:00:00.000Z',
  group: { id: 'g', name: 'Fictif', currency: 'CAD' },
  members: [{ userId: 'alice', role: 'owner', status: 'active' }],
  expenses: [{ id: 'e', date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 101,
    categoryId: 'other', categoryLabel: 'Autre', categoryIcon: '📌', categoryColor: 'slate',
    payments: [{ userId: 'alice', amountMinor: 101 }], allocations: [{ userId: 'alice', amountMinor: 101 }],
    splitSnapshotJson: '{"kind":"equal","users":["alice"]}', deleted: false }],
  settlements: [], importedRecords: [], categories: [],
  expenseAuthors: [{ expenseId: 'e', userId: 'alice' }],
  receiptOwners: [{ expenseId: 'e', attachmentId: 'a', ownerId: 'alice' }],
  comments: [{ expenseId: 'e', id: 'c', authorId: 'alice', text: 'Commentaire fictif', createdAt: '2026-11-16T18:00:00.000Z' }],
  activity: [{ id: 'e', actorId: 'alice', action: 'expense_created', at: '2026-11-16T18:00:00.000Z', expenseId: 'e' }],
  importBatches: [],
  receipts: [{ expenseId: 'e', attachmentId: 'a', format: 'png', status: 'active', mediaIncluded: false }],
  preferences: [{ userId: 'alice', modeJson: '{"kind":"equal","users":["alice"]}', memberIds: ['alice'], updatedAt: '2026-11-16T18:00:00.000Z' }],
};

async function packageFixture(): Promise<BackupPackageV2> {
  const groupJson = serializeGroupExportV2(group);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const sha256 = await sha256Hex(bytes);
  return {
    groupJson,
    manifest: { format: 'OurFinanceBackupManifest', version: 2, scope: 'group-v2-partial', groupId: 'g', exportedAt: group.exportedAt,
      groupJson: { filename: 'group.json', sha256: await sha256Hex(new TextEncoder().encode(groupJson)), byteLength: new TextEncoder().encode(groupJson).byteLength },
      receipts: [{ expenseId: 'e', attachmentId: 'a', filename: 'g/e/a.png', sha256, byteLength: bytes.byteLength, contentType: 'image/png' }] },
    receipts: [{ filename: 'g/e/a.png', bytes, sha256, byteLength: bytes.byteLength, contentType: 'image/png' }],
  };
}

test('V2 ZIP preserves member preference and private receipt bytes', async () => {
  const backup = await packageFixture();
  const decoded = await decodeBackupZipV2(await encodeBackupZipV2(backup));
  strictEqual(JSON.parse(decoded.groupJson).preferences[0].modeJson, group.preferences[0].modeJson);
  strictEqual(JSON.parse(decoded.groupJson).comments[0].text, 'Commentaire fictif');
  deepStrictEqual(decoded.receipts[0].bytes, backup.receipts[0].bytes);
});

test('V2 refuses a modified preference, receipt or manifest scope', async () => {
  const backup = await packageFixture();
  await rejects(verifyBackupPackageV2({ ...backup, groupJson: backup.groupJson.replace('alice', 'other') }));
  await rejects(verifyBackupPackageV2({ ...backup, receipts: [{ ...backup.receipts[0], bytes: new Uint8Array([1]) }] }));
  await rejects(verifyBackupPackageV2({ ...backup, manifest: { ...backup.manifest, scope: 'group-v1-partial' as 'group-v2-partial' } }));
  await rejects(verifyBackupPackageV2({ ...backup, groupJson: JSON.stringify({ ...group, expenseAuthors: [] }) }));
  await rejects(verifyBackupPackageV2({ ...backup, groupJson: JSON.stringify({ ...group, receiptOwners: [] }) }));
  throws(() => serializeGroupExportV2({ ...group, receiptOwners: [{ ...group.receiptOwners[0], ownerId: 'outsider' }] }));
});

test('restore preflight verifies the archived receipt and original group before any write', async () => {
  const backup = await packageFixture();
  const target = { groupId: 'g', currency: 'CAD', memberIds: ['alice'], ownerId: 'alice', memberStatuses: { alice: 'active' as const } };
  const result = await preflightBackupRestoreV2(backup, target);
  strictEqual(result.receiptCount, 1);
  strictEqual(result.preferenceCount, 1);
  strictEqual(result.commentCount, 1);
  strictEqual(result.activityCount, 1);
  await rejects(preflightBackupRestoreV2(backup, { ...target, groupId: 'other' }));
  await rejects(preflightBackupRestoreV2(backup, { ...target, ownerId: 'other' }));
  await rejects(preflightBackupRestoreV2(backup, { ...target, memberStatuses: { alice: 'revoked' } }));
  await rejects(preflightBackupRestoreV2({ ...backup, receipts: [{ ...backup.receipts[0], bytes: new Uint8Array([1]) }] }, target));
});

test('restore inventory includes private receipt, comments and personal preference paths', () => {
  const inventory = restoreInventoryV2(group);
  strictEqual(inventory.groupDocuments.includes('groups/g/expenses/e/comments/c'), true);
  strictEqual(inventory.receiptDocuments[0], 'groups/g/expenses/e/attachments/a');
  strictEqual(inventory.userDocuments.includes('users/alice/groupPreferences/g'), true);
  strictEqual(inventory.groupDocuments.includes('groups/g/activity/e'), true);
});

test('dry-run marks stale operations and derived documents for deletion', () => {
  const diff = compareRestoreInventoryV2(group,
    ['groups/g', 'groups/g/expenses/old', 'groups/g/balances/old', 'groups/g/invitations/old'],
    ['users/alice/groupMemberships/g', 'users/alice/groupPreferences/g', 'users/alice/importBatches/old']);
  deepStrictEqual(diff.deleteGroupDocuments, ['groups/g/expenses/old', 'groups/g/balances/old', 'groups/g/invitations/old']);
  strictEqual(diff.replaceGroupDocuments.includes('groups/g/expenses/e'), true);
  deepStrictEqual(diff.deleteUserDocuments, ['users/alice/importBatches/old']);
  const withoutPreference = { ...group, preferences: [{ userId: 'alice', modeJson: null, memberIds: [], updatedAt: null }] };
  const absent = compareRestoreInventoryV2(withoutPreference, ['groups/g'], ['users/alice/groupPreferences/g']);
  deepStrictEqual(absent.deleteUserDocuments, ['users/alice/groupPreferences/g']);
  throws(() => compareRestoreInventoryV2(group, ['groups/other/expenses/e'], []));
  throws(() => compareRestoreInventoryV2(group, ['groups/g/unknown/x'], []));
});
