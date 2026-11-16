import assert from 'node:assert/strict';
import test from 'node:test';
import { collectGroupExportV2 } from '../../src/app/features/import-export/export-collector-v2';
import type { ExportDocument, ExportReader } from '../../src/app/features/import-export/export-collector';
import { serializeGroupExportV2, type GroupExportV2 } from '../../src/app/features/import-export/export-v2';

const fx = { id: 'fx_1', date: '2026-11-16', debtCurrency: 'CAD', debtAmountMinor: 51,
  paymentCurrency: 'JPY', paymentAmountMinor: 1, rate: '2', rateDate: '2026-11-16',
  fromUserId: 'member_b', toUserId: 'member_a', status: 'recorded' as const, deleted: false };
const group: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, exportedAt: '2026-11-16T18:00:00.000Z',
  group: { id: 'group_test', name: 'Groupe fictif', currency: 'CAD' },
  members: [{ userId: 'member_a', role: 'owner', status: 'active' }, { userId: 'member_b', role: 'member', status: 'active' }],
  expenses: [], settlements: [], importedRecords: [], categories: [], receipts: [], fxSettlements: [fx],
};

test('V2 preserves the two FX amounts and excludes unknown Firestore metadata', () => {
  const serialized = serializeGroupExportV2({ ...group, fxSettlements: [{ ...fx, hiddenSecret: 'must-not-export' } as typeof fx] });
  const value = JSON.parse(serialized) as GroupExportV2;
  assert.equal(value.version, 2);
  assert.equal(value.fxSettlements[0].debtAmountMinor, 51);
  assert.equal(value.fxSettlements[0].paymentAmountMinor, 1);
  assert.equal(value.fxSettlements[0].rate, '2');
  assert.equal(serialized.includes('must-not-export'), false);
});

test('V2 rejects duplicate FX IDs, malformed rates and members outside the group', () => {
  assert.throws(() => serializeGroupExportV2({ ...group, fxSettlements: [fx, fx] }), /invalide/);
  assert.throws(() => serializeGroupExportV2({ ...group, fxSettlements: [{ ...fx, paymentAmountMinor: 2 }] }), /incohérent/);
  assert.throws(() => serializeGroupExportV2({ ...group, fxSettlements: [{ ...fx, toUserId: 'outsider' }] }), /invalide/);
});

test('V2 collector reads FX through group rules and checks revocation after collection', async () => {
  const root = 'groups/group_test';
  let membershipReads = 0;
  const reader: ExportReader = {
    read: async path => {
      if (path === root) return { id: 'group_test', data: { name: 'Groupe fictif', currency: 'CAD', status: 'active' } };
      if (path === `${root}/members/member_a`) {
        membershipReads++;
        return { id: 'member_a', data: { status: 'active', role: 'owner' } };
      }
      return null;
    },
    list: async path => {
      if (path === `${root}/members`) return group.members.map(row => ({ id: row.userId, data: { role: row.role, status: row.status } }));
      if (path === `${root}/fxSettlements`) return [{ id: fx.id, data: { ...fx, hiddenSecret: 'must-not-export' } }];
      return [] as ExportDocument[];
    },
  };
  const exported = await collectGroupExportV2(reader, { uid: 'member_a', emailVerified: true }, 'group_test', group.exportedAt);
  assert.equal((JSON.parse(exported) as GroupExportV2).fxSettlements.length, 1);
  assert.equal(exported.includes('must-not-export'), false);
  assert.equal(membershipReads, 3);
  let finalReads = 0;
  const revoked: ExportReader = { ...reader, read: async path => path === `${root}/members/member_a` && ++finalReads === 3 ?
    { id: 'member_a', data: { status: 'revoked', role: 'owner' } } : reader.read(path) };
  await assert.rejects(collectGroupExportV2(revoked, { uid: 'member_a', emailVerified: true }, 'group_test', group.exportedAt), /révoqué/);
});
