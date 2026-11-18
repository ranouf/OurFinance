import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import type { FirebaseApp } from 'firebase/app';
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { ActivityService, type ActivityRepository } from '../../src/app/core/firebase/activity-service';
import { ImportService } from '../../src/app/features/import-export/import-service';

const app = {} as FirebaseApp;
const row = (id: string, data: Record<string, unknown>) => ({ id, data: () => data }) as QueryDocumentSnapshot<DocumentData>;
const page = (docs: QueryDocumentSnapshot<DocumentData>[]) => ({ docs, size: docs.length }) as QuerySnapshot<DocumentData>;

test('account activity pages are scoped to one group and keep their cursor and actor', async () => {
  const calls: string[] = [];
  const repository: ActivityRepository = { history: async (_app, groupId, after, pageSize) => {
    calls.push(`${groupId}:${after?.id ?? ''}:${pageSize}`);
    return page([row('event-1', { actorId: 'alice', action: 'expense_created', at: '2026-11-18' }),
      row('event-2', { actorId: 'bob', action: 'settlement_created', at: '2026-11-17' })]);
  } };
  const result = await new ActivityService(app, repository).history('group-a', row('cursor', {}), 2);
  deepStrictEqual(result.entries.map(item => [item.id, item.actorId, item.action]),
    [['event-1', 'alice', 'expense_created'], ['event-2', 'bob', 'settlement_created']]);
  strictEqual(result.last?.id, 'event-2');
  strictEqual(result.hasMore, true);
  deepStrictEqual(calls, ['group-a:cursor:2']);
});

test('activity service rejects invalid group and excessive page size before Firestore reads', async () => {
  let calls = 0;
  const repository: ActivityRepository = { history: async () => { calls++; return page([]); } };
  const service = new ActivityService(app, repository);
  await rejects(service.history('../other'), /invalide/);
  await rejects(service.history('group-a', undefined, 51), /invalide/);
  await rejects(service.history('group-a', undefined, 0), /invalide/);
  await rejects(service.history('group-a', undefined, 1.5), /invalide/);
  strictEqual(calls, 0);
  deepStrictEqual((await service.history('group-a')).entries, []);
  strictEqual(calls, 1);
});

test('account import service never retries a rejected batch under another group', async () => {
  const batchId = '01234567-89ab-4def-8abc-0123456789ab';
  const calls: string[] = [];
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(`${init?.method}:${String(input)}`);
    return Response.json({ error: 'duplicate_source' }, { status: 409 });
  };
  const service = new ImportService('https://worker.example', transport as typeof fetch);
  const user = { emailVerified: true, getIdToken: async () => 'fixture-token' };
  const batch = { groupId: 'group-a', body: { batchId, records: [] } };
  await rejects(service.create(user, batch), /HTTP 409/);
  deepStrictEqual(calls, ['POST:https://worker.example/groups/group-a/imports']);
  await rejects(service.undo(user, 'group-a', 'bad-batch'), /invalide/);
  strictEqual(calls.length, 1);
});
