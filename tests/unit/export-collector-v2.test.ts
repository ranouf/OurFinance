import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { collectGroupExportV2 } from '../../src/app/features/import-export/export-collector-v2';
import type { ExportReader } from '../../src/app/features/import-export/export-collector';

const member = { id: 'alice', data: { role: 'owner', status: 'active' } };
const reader: ExportReader = {
  read: async path => path === 'groups/g' ? { id: 'g', data: { name: 'Groupe fictif', currencyCode: 'CAD', status: 'active' } } :
    path === 'groups/g/members/alice' ? member : null,
  list: async path => path === 'groups/g/members' ? [member, { id: 'bob', data: { role: 'member', status: 'active' } }] : [],
};
const user = { uid: 'alice', emailVerified: true, getIdToken: async () => 'synthetic-id-token' };
const rows = [
  { userId: 'bob', modeJson: null, memberIds: [], updatedAt: null },
  { userId: 'alice', modeJson: '{"kind":"equal","users":["alice","bob"]}', memberIds: ['alice', 'bob'], updatedAt: '2026-11-16T18:00:00.000Z' },
];

test('owner combines the Worker snapshot with the group in member order', async () => {
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    strictEqual(String(resource), 'https://worker.example/groups/g/backup/preferences');
    strictEqual((init?.headers as Record<string, string>).Authorization, 'Bearer synthetic-id-token');
    return Response.json({ preferences: rows });
  };
  const result = JSON.parse(await collectGroupExportV2(reader, user, 'g', 'https://worker.example', transport as typeof fetch));
  strictEqual(result.version, 2);
  deepStrictEqual(result.preferences.map((row: { userId: string }) => row.userId), ['alice', 'bob']);
  strictEqual(result.preferences[1].modeJson, null);
});

test('collector refuses an incomplete or denied preference snapshot', async () => {
  const incomplete = async () => Response.json({ preferences: rows.slice(0, 1) });
  await rejects(collectGroupExportV2(reader, user, 'g', 'https://worker.example', incomplete as typeof fetch));
  const denied = async () => Response.json({}, { status: 403 });
  await rejects(collectGroupExportV2(reader, user, 'g', 'https://worker.example', denied as typeof fetch));
});
