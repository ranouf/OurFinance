import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { encodeBackupZipV1 } from '../../src/app/features/import-export/backup-zip';
import { previewBackupRestoreV1 } from '../../src/app/features/import-export/backup-restore-preview';
import { serializeGroupExportV1 } from '../../src/app/features/import-export/export-v1';

test('previews only the verified partial scope and its omissions', async () => {
  const exportedAt = '2026-11-16T18:00:00.000Z';
  const groupJson = serializeGroupExportV1({ format: 'OurFinanceGroupExport', version: 1, exportedAt,
    group: { id: 'fake_group', name: 'Fictif', currency: 'CAD' },
    members: [{ userId: 'member_a', role: 'owner', status: 'active' }], expenses: [], settlements: [], importedRecords: [], categories: [], receipts: [],
  });
  const groupBytes = new TextEncoder().encode(groupJson);
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', groupBytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const zip = await encodeBackupZipV1({ groupJson, receipts: [], manifest: {
    format: 'OurFinanceBackupManifest', version: 1, groupId: 'fake_group', exportedAt, scope: 'group-v1-partial',
    groupJson: { filename: 'group.json', sha256, byteLength: groupBytes.length }, receipts: [],
  } });
  const preview = await previewBackupRestoreV1(zip);
  strictEqual(preview.groupName, 'Fictif');
  strictEqual(preview.counts.members, 1);
  strictEqual(preview.counts.privateReceiptFiles, 0);
  strictEqual(preview.omitted.includes('comptes et identités Auth'), true);
  const corrupted = Uint8Array.from(zip); corrupted[80] ^= 1;
  await rejects(previewBackupRestoreV1(corrupted));
});
