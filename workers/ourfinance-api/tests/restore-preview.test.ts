import { test } from 'node:test';
import { deepStrictEqual, rejects } from 'node:assert';
import { sha256Hex } from '../../../src/app/features/import-export/backup-package';
import type { BackupPackageV2 } from '../../../src/app/features/import-export/backup-package-v2';
import { serializeGroupExportV2, type GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { summarizeRestorePreviewV2 } from '../src/restore-preview';

const at = '2026-11-16T18:00:00.000Z';
const group: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, snapshotMode: 'server_transaction', exportedAt: at,
  group: { id: 'g', name: 'Fictif', currency: 'CAD' },
  members: [{ userId: 'alice', role: 'owner', status: 'active' }],
  expenses: [{ id: 'new', date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 101,
    categoryId: 'other', categoryLabel: 'Autre', categoryIcon: '📌', categoryColor: 'slate',
    payments: [{ userId: 'alice', amountMinor: 101 }], allocations: [{ userId: 'alice', amountMinor: 101 }],
    splitSnapshotJson: '{"kind":"equal","users":["alice"]}', deleted: false }],
  settlements: [], importedRecords: [], categories: [], receipts: [],
  expenseAuthors: [{ expenseId: 'new', userId: 'alice' }], receiptOwners: [], receiptAssets: [],
  comments: [], activity: [], importBatches: [],
  preferences: [{ userId: 'alice', modeJson: null, memberIds: [], updatedAt: null }],
};

async function archive(value: GroupExportV2 = group): Promise<BackupPackageV2> {
  const groupJson = serializeGroupExportV2(value);
  const bytes = new TextEncoder().encode(groupJson);
  return { groupJson, receipts: [], manifest: {
    format: 'OurFinanceBackupManifest', version: 2, scope: 'group-v2-partial', groupId: 'g', exportedAt: at,
    groupJson: { filename: 'group.json', sha256: await sha256Hex(bytes), byteLength: bytes.byteLength }, receipts: [],
  } };
}

test('restore preview counts only actual create, replace and delete paths', async () => {
  const live = { groupDocuments: ['groups/g', 'groups/g/members/alice', 'groups/g/expenses/old'],
    userDocuments: ['users/alice/groupMemberships/g'], receiptPublicIds: [] };
  deepStrictEqual(await summarizeRestorePreviewV2(await archive(), 'g', live), { create: 1, replace: 1, delete: 1 });
});

test('restore preview rejects a client-collected or mismatched archive', async () => {
  const live = { groupDocuments: ['groups/g', 'groups/g/members/alice'], userDocuments: [], receiptPublicIds: [] };
  await rejects(summarizeRestorePreviewV2(await archive({ ...group, snapshotMode: 'client_partial' }), 'g', live));
  await rejects(summarizeRestorePreviewV2(await archive(), 'other', live));
});
