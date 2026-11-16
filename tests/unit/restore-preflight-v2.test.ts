import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { serializeGroupExportV2, type GroupExportV2 } from '../../src/app/features/import-export/export-v2';
import { preflightGroupRestoreV2 } from '../../src/app/features/import-export/restore-preflight-v2';

const fixture: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, exportedAt: '2026-11-16T18:00:00.000Z',
  group: { id: 'original_group', name: 'Groupe fictif', currency: 'CAD' },
  members: [{ userId: 'alice', role: 'owner', status: 'active' }, { userId: 'bob', role: 'member', status: 'revoked' }],
  expenses: [], settlements: [], importedRecords: [], categories: [], receipts: [],
  expenseAuthors: [],
  comments: [],
  activity: [],
  preferences: [
    { userId: 'alice', modeJson: '{"kind":"equal","users":["alice","bob"]}', memberIds: ['alice', 'bob'], updatedAt: '2026-11-16T18:00:00.000Z' },
    { userId: 'bob', modeJson: null, memberIds: [], updatedAt: null },
  ],
};
const target = { groupId: 'original_group', currency: 'CAD', memberIds: ['bob', 'alice'] };

test('preflight counts preferences and checks the original group and members without writing', () => {
  const result = preflightGroupRestoreV2(serializeGroupExportV2(fixture), target);
  deepStrictEqual([result.preferenceCount, result.absentPreferenceCount], [1, 1]);
  strictEqual(result.groupId, 'original_group');
});

test('preflight refuses another group, currency, member set or malformed backup', () => {
  const json = serializeGroupExportV2(fixture);
  throws(() => preflightGroupRestoreV2(json, { ...target, groupId: 'another_group' }));
  throws(() => preflightGroupRestoreV2(json, { ...target, currency: 'JPY' }));
  throws(() => preflightGroupRestoreV2(json, { ...target, memberIds: ['alice', 'outsider'] }));
  throws(() => preflightGroupRestoreV2('{', target));
  throws(() => preflightGroupRestoreV2(JSON.stringify({ ...fixture, preferences: [] }), target));
});
