import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import type { User } from 'firebase/auth';
import { buildBackupPackageV1, verifyBackupPackageV1 } from '../../src/app/features/import-export/backup-package';
import type { ExportReader } from '../../src/app/features/import-export/export-collector';

const root = 'groups/group_test';
const member = { id: 'member_a', data: { role: 'owner', status: 'active' } };
const reader: ExportReader = {
  read: async path => path === root ? { id: 'group_test', data: { status: 'active', name: 'Groupe fictif', currency: 'CAD' } } : path === `${root}/members/member_a` ? member : null,
  list: async path => {
    if (path === `${root}/members`) return [member];
    if (path === `${root}/expenses`) return [{ id: 'expense_1', data: {
      date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 100, categoryId: 'other',
      categoryLabel: 'Autre', categoryIcon: 'circle', categoryColor: 'slate', payments: [{ userId: 'member_a', amountMinor: 100 }],
      allocations: [{ userId: 'member_a', amountMinor: 100 }], splitSnapshotJson: '{"kind":"equal"}', deleted: false,
    } }];
    if (path === `${root}/expenses/expense_1/attachments`) return [{ id: 'receipt_1', data: { format: 'png', status: 'active' } }];
    return [];
  },
};
const user = { uid: 'member_a', emailVerified: true, getIdToken: async () => 'synthetic-token' } as Pick<User, 'uid' | 'emailVerified' | 'getIdToken'>;
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==', 'base64'));
const transport = (async () => new Response(png, { status: 200, headers: { 'Content-Type': 'image/png' } })) as typeof fetch;

test('builds an explicitly partial manifest with exact hashes and verifies all bytes', async () => {
  const packageValue = await buildBackupPackageV1(reader, user, 'group_test', 'https://worker.example', transport);
  strictEqual(packageValue.manifest.scope, 'group-v1-partial');
  strictEqual(packageValue.manifest.receipts.length, 1);
  strictEqual(packageValue.manifest.receipts[0].byteLength, png.byteLength);
  strictEqual(JSON.parse(packageValue.groupJson).receipts[0].mediaIncluded, false);
  await verifyBackupPackageV1(packageValue);
  const corrupted = { ...packageValue, receipts: [{ ...packageValue.receipts[0], bytes: Uint8Array.from(packageValue.receipts[0].bytes) }] };
  corrupted.receipts[0].bytes[12] ^= 1;
  await rejects(verifyBackupPackageV1(corrupted), /Intégrité/);
  await rejects(verifyBackupPackageV1({ ...packageValue, receipts: [] }), /invalide/);
});

test('does not return a package when a private receipt is denied', async () => {
  const denied = (async () => new Response(null, { status: 403 })) as typeof fetch;
  await rejects(buildBackupPackageV1(reader, user, 'group_test', 'https://worker.example', denied), /403/);
});

test('does not return a package when the member is revoked after receipt download', async () => {
  let membershipReads = 0;
  const revoked: ExportReader = { ...reader, read: async path => {
    if (path === `${root}/members/member_a` && ++membershipReads === 3) return { id: 'member_a', data: { role: 'owner', status: 'revoked' } };
    return reader.read(path);
  } };
  await rejects(buildBackupPackageV1(revoked, user, 'group_test', 'https://worker.example', transport), /révoqué/);
});
