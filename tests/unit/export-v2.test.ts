import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { serializeGroupExportV2, type GroupExportV2 } from '../../src/app/features/import-export/export-v2';

const exportedAt = '2026-11-16T18:00:00.000Z';
const fixture: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, exportedAt,
  group: { id: 'g', name: 'Groupe fictif', currency: 'CAD' },
  members: [{ userId: 'alice', role: 'owner', status: 'active' }, { userId: 'bob', role: 'member', status: 'revoked' }],
  expenses: [], settlements: [], importedRecords: [], categories: [], receipts: [],
  preferences: [
    { userId: 'alice', modeJson: '{"kind":"exact","amounts":[{"userId":"alice","amountMinor":50},{"userId":"bob","amountMinor":51}]}', memberIds: ['alice', 'bob'], updatedAt: exportedAt },
    { userId: 'bob', modeJson: null, memberIds: [], updatedAt: null },
  ],
};

test('V2 preserves every member preference or its explicit absence', () => {
  const json = serializeGroupExportV2(fixture);
  const value = JSON.parse(json) as GroupExportV2;
  strictEqual(value.version, 2);
  deepStrictEqual(value.preferences, fixture.preferences);
  strictEqual(value.group.currency, 'CAD');
});

test('V2 rejects missing, foreign or inconsistent preferences', () => {
  throws(() => serializeGroupExportV2({ ...fixture, preferences: fixture.preferences.slice(0, 1) }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...fixture.preferences[0], userId: 'outsider' }, fixture.preferences[1]] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...fixture.preferences[0], memberIds: ['alice'] }, fixture.preferences[1]] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [fixture.preferences[0], { ...fixture.preferences[1], updatedAt: exportedAt }] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...fixture.preferences[0], modeJson: '{"kind":"equal","users":["outsider"]}' }, fixture.preferences[1]] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [null as unknown as GroupExportV2['preferences'][number], fixture.preferences[1]] }));
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...fixture.preferences[0], updatedAt: 'tomorrow' }, fixture.preferences[1]] }));
});

test('V2 validates percentages, signed adjustments and removes unexpected preference fields', () => {
  const percentage = { ...fixture.preferences[0], modeJson: '{"kind":"percentage","weightsBasisPoints":[{"userId":"alice","value":5000},{"userId":"bob","value":5000}]}' };
  const valid = { ...fixture, preferences: [{ ...percentage, accidentalSecret: 'never-export' }, fixture.preferences[1]] };
  strictEqual(serializeGroupExportV2(valid).includes('never-export'), false);
  throws(() => serializeGroupExportV2({ ...fixture, preferences: [{ ...percentage, modeJson: '{"kind":"percentage","weightsBasisPoints":[{"userId":"alice","value":5000}]}' }, fixture.preferences[1]] }));
  const adjustment = { ...fixture.preferences[0], modeJson: '{"kind":"adjustment","adjustments":[{"userId":"alice","amountMinor":-10},{"userId":"bob","amountMinor":10}]}' };
  strictEqual(JSON.parse(serializeGroupExportV2({ ...fixture, preferences: [adjustment, fixture.preferences[1]] })).preferences[0].modeJson, adjustment.modeJson);
});
