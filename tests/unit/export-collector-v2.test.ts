import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { collectGroupExportV2, collectGroupExportV2FromReader } from '../../src/app/features/import-export/export-collector-v2';
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
  const outsider = async () => Response.json({ preferences: [...rows, { userId: 'outsider', modeJson: null, memberIds: [], updatedAt: null }] });
  await rejects(collectGroupExportV2(reader, user, 'g', 'https://worker.example', outsider as typeof fetch));
  const denied = async () => Response.json({}, { status: 403 });
  await rejects(collectGroupExportV2(reader, user, 'g', 'https://worker.example', denied as typeof fetch));
});

test('collector preserves expense authors and comments from Firestore documents', async () => {
  const expense = { id: 'expense', data: { date: '2026-11-01', description: 'Fictif', currency: 'CAD', amountMinor: 101,
    categoryId: 'other', categoryLabel: 'Autre', categoryIcon: 'receipt', categoryColor: 'slate',
    payments: [{ userId: 'alice', amountMinor: 101 }], allocations: [{ userId: 'alice', amountMinor: 101 }],
    splitSnapshotJson: '{"kind":"equal","users":["alice"]}', deleted: false, createdBy: 'alice' } };
  const withExpense: ExportReader = {
    read: reader.read,
    list: async path => path === 'groups/g/expenses' ? [expense] :
      path === 'groups/g/expenses/expense/attachments' ? [{ id: 'receipt', data: { format: 'png', status: 'active', ownerId: 'alice' } }] :
      path === 'groups/g/expenses/expense/comments' ? [{ id: 'comment', data: { authorId: 'alice', text: 'Note fictive', createdAt: { toDate: () => new Date('2026-11-16T18:00:00.000Z') } } }] :
      path === 'groups/g/activity' ? [{ id: 'expense', data: { actorId: 'alice', action: 'expense_created', expenseId: 'expense', at: { toDate: () => new Date('2026-11-16T18:00:00.000Z') } } }] :
      reader.list(path),
  };
  const transport = async () => Response.json({ preferences: rows });
  const result = JSON.parse(await collectGroupExportV2(withExpense, user, 'g', 'https://worker.example', transport as typeof fetch));
  deepStrictEqual(result.expenseAuthors, [{ expenseId: 'expense', userId: 'alice' }]);
  deepStrictEqual(result.receiptOwners, [{ expenseId: 'expense', attachmentId: 'receipt', ownerId: 'alice' }]);
  deepStrictEqual(result.comments, [{ expenseId: 'expense', id: 'comment', authorId: 'alice', text: 'Note fictive', createdAt: '2026-11-16T18:00:00.000Z' }]);
  deepStrictEqual(result.activity, [{ id: 'expense', actorId: 'alice', action: 'expense_created', at: '2026-11-16T18:00:00.000Z', expenseId: 'expense' }]);
});

test('one transactional reader can collect every member preference without a Worker callback', async () => {
  const snapshot: ExportReader = { list: reader.list, read: async path => path === 'users/alice/groupPreferences/g'
    ? { id: 'g', data: { modeJson: '{"kind":"equal","users":["alice","bob"]}', updatedAt: '2026-11-16T18:00:00.000Z' } }
    : reader.read(path) };
  const result = JSON.parse(await collectGroupExportV2FromReader(snapshot, user, 'g'));
  deepStrictEqual(result.preferences[0].memberIds, ['alice', 'bob']);
  strictEqual(result.preferences[1].modeJson, null);
});
