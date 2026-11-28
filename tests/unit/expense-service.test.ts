import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { ExpenseService, type ExpenseRepository } from '../../src/app/core/firebase/expense-service';
import { ExpenseCreateUncertainError, ExpenseCreateConflictError } from '../../src/app/core/firebase/expense-service';
import { expenseFingerprint } from '../../src/app/shared/utils/expense-fingerprint';

const app = {} as FirebaseApp;
const user = { uid: 'alice', emailVerified: true, getIdToken: async () => 'fixture-token' } as User;
const row = (id: string, data: Record<string, unknown>) =>
  ({ id, data: () => data }) as QueryDocumentSnapshot<DocumentData>;
const page = (docs: QueryDocumentSnapshot<DocumentData>[]) =>
  ({ docs, size: docs.length }) as QuerySnapshot<DocumentData>;
const preference = (data?: Record<string, unknown>) =>
  ({ exists: () => data !== undefined, data: () => data }) as DocumentSnapshot<DocumentData>;

function fixture(rows: QueryDocumentSnapshot<DocumentData>[] = []) {
  const calls: string[] = [];
  const repository: ExpenseRepository = {
    history: async (_app, groupId, after, from, to) => {
      calls.push(`history:${groupId}:${after?.id ?? ''}:${from ?? ''}:${to ?? ''}`);
      return page(rows);
    },
    members: async (_app, groupId) => {
      calls.push(`members:${groupId}`);
      return page([row('alice', { role: 'owner', status: 'active' }), row('bob', { role: 'member', status: 'revoked' })]);
    },
    preference: async (_app, uid, groupId) => {
      calls.push(`preference:${uid}:${groupId}`);
      return preference({ modeJson: '{"kind":"equal","users":["alice","bob"]}' });
    },
  };
  const requests: { url: string; method: string; authorization: string | null; body: unknown }[] = [];
  let reply: Response = Response.json({ expenseId: 'expense-1' });
  let lostResponses = 0;
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input), method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('Authorization'), body: JSON.parse(String(init?.body ?? '{}')),
    });
    if (lostResponses-- > 0) throw new TypeError('network lost');
    return reply;
  };
  const service = new ExpenseService(app, 'https://worker.example', repository, transport as typeof fetch);
  return { service, repository, calls, requests, reply: (response: Response) => { reply = response; }, lose: (count: number) => { lostResponses = count; } };
}

test('une réponse perdue confirme le document existant sans seconde création', async () => {
  const f = fixture();
  const idempotencyKey = 'ae4b59c1-e386-4a6c-83e2-989f1c8bb077';
  const body = { idempotencyKey, description: 'Repas fictif', categoryId: 'other', currency: 'CAD', date: '2026-11-27', amountMinor: 101,
    payments: [{ userId: 'alice', amountMinor: 101 }], splitMode: { kind: 'equal' as const, users: ['alice', 'bob'] } };
  const fingerprint = await expenseFingerprint(body, [{ userId: 'alice', amountMinor: 51 }, { userId: 'bob', amountMinor: 50 }]);
  f.repository.expenseById = async (_app, groupId, expenseId) => {
    deepStrictEqual([groupId, expenseId], ['group-a', idempotencyKey]);
    return preference({ createdBy: 'alice', contentFingerprint: fingerprint });
  };
  f.lose(1);
  strictEqual(await f.service.create(user, 'group-a', body), idempotencyKey);
  strictEqual(f.requests.length, 1);
  f.repository.expenseById = async () => preference({ createdBy: 'bob', contentFingerprint: fingerprint });
  f.lose(1);
  await rejects(f.service.create(user, 'group-a', body), ExpenseCreateConflictError);
});

test('si le document est absent, le retry garde la clé ; une lecture impossible reste incertaine', async () => {
  const f = fixture();
  const idempotencyKey = 'ae4b59c1-e386-4a6c-83e2-989f1c8bb077';
  const body = { idempotencyKey, description: 'Repas fictif', categoryId: 'other', currency: 'CAD', date: '2026-11-27', amountMinor: 101,
    payments: [{ userId: 'alice', amountMinor: 101 }], splitMode: { kind: 'equal' as const, users: ['alice', 'bob'] } };
  f.repository.expenseById = async () => preference();
  f.reply(Response.json({ expenseId: idempotencyKey }));
  f.lose(1);
  strictEqual(await f.service.create(user, 'group-a', body), idempotencyKey);
  deepStrictEqual(f.requests.map(item => (item.body as { idempotencyKey: string }).idempotencyKey), [idempotencyKey, idempotencyKey]);
  f.repository.expenseById = async () => { throw new Error('read unavailable'); };
  f.lose(1);
  await rejects(f.service.create(user, 'group-a', body), ExpenseCreateUncertainError);
  strictEqual(f.requests.length, 3);
  f.repository.expenseById = async () => preference();
  f.reply(Response.json({ error: 'temporary' }, { status: 503 }));
  f.lose(1);
  await rejects(f.service.create(user, 'group-a', body), ExpenseCreateUncertainError);
  strictEqual(f.requests.length, 5);
});

test('expense history pages within one group, skips deleted rows and preserves exact split data', async () => {
  const split = { kind: 'equal', users: ['alice', 'bob'] };
  const rows = [
    row('deleted', { deleted: true }),
    row('visible', { createdBy: 'alice', revision: 2, description: 'Café', date: '2026-11-18',
      amountMinor: 1250, currency: 'CAD', categoryId: 'other', payments: [{ userId: 'alice', amountMinor: 1250 }],
      allocations: [{ userId: 'bob', amountMinor: 1250 }], splitSnapshotJson: JSON.stringify(split) }),
  ];
  const f = fixture(rows);
  const result = await f.service.history('group-a', rows[0], '2026-11-01', '2026-11-30');
  strictEqual(result.entries.length, 1);
  deepStrictEqual(result.entries[0].splitMode, split);
  strictEqual(result.entries[0].amountMinor, 1250);
  strictEqual(result.scanned, 2);
  strictEqual(result.last?.id, 'visible');
  strictEqual(result.hasMore, false);
  deepStrictEqual(f.calls, ['history:group-a:deleted:2026-11-01:2026-11-30']);
});

test('member list and split preference are scoped to active members of one group', async () => {
  const f = fixture();
  const members = await f.service.members('group-a');
  deepStrictEqual(members, [
    { userId: 'alice', role: 'owner', status: 'active' },
    { userId: 'bob', role: 'member', status: 'revoked' },
  ]);
  strictEqual(await f.service.preference(user, 'group-a', new Set(['alice'])), undefined);
  deepStrictEqual(await f.service.preference(user, 'group-a', new Set(['alice', 'bob'])),
    { kind: 'equal', users: ['alice', 'bob'] });
  f.repository.preference = async () => preference();
  strictEqual(await f.service.preference(user, 'group-a', new Set(['alice', 'bob'])), undefined);
});

test('create and mutate send verified identity, group scope and request body to Worker', async () => {
  const f = fixture();
  strictEqual(await f.service.create(user, 'group-a', { description: 'Café' }), 'expense-1');
  f.reply(new Response(null, { status: 204 }));
  await f.service.mutate(user, 'group-a', 'expense-1', 'PATCH', { revision: 2 });
  await f.service.mutate(user, 'group-a', 'expense-1', 'DELETE', { revision: 2 });
  deepStrictEqual(f.requests.map(request => [request.url, request.method, request.authorization, request.body]), [
    ['https://worker.example/groups/group-a/expenses', 'POST', 'Bearer fixture-token', { description: 'Café' }],
    ['https://worker.example/groups/group-a/expenses/expense-1', 'PATCH', 'Bearer fixture-token', { revision: 2 }],
    ['https://worker.example/groups/group-a/expenses/expense-1', 'DELETE', 'Bearer fixture-token', { revision: 2 }],
  ]);
});

test('default transport calls fetch without binding the service as receiver', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let receiver: unknown;
  globalThis.fetch = (async function (this: unknown) {
    receiver = this;
    return Response.json({ expenseId: 'expense-1' });
  }) as typeof fetch;
  const service = new ExpenseService(app, 'https://worker.example', fixture().repository);
  strictEqual(await service.create(user, 'group-a', { description: 'Fictif' }), 'expense-1');
  strictEqual(receiver instanceof ExpenseService, false);
});

test('unverified users, insecure Worker, disabled route and malformed success cannot create a row', async () => {
  const f = fixture();
  await rejects(f.service.create({ ...user, emailVerified: false } as User, 'group-a', {}), /courriel/);
  strictEqual(f.requests.length, 0);
  const insecure = new ExpenseService(app, 'http://worker.example', f.repository, async () => Response.json({ expenseId: 'x' }));
  await rejects(insecure.create(user, 'group-a', {}), /sécurisée/);
  f.reply(Response.json({ error: 'disabled' }, { status: 503 }));
  await rejects(f.service.create(user, 'group-a', {}), /désactivée/);
  f.reply(Response.json({}));
  await rejects(f.service.create(user, 'group-a', {}), /invalide/);
  f.reply(Response.json({ error: 'denied' }, { status: 403 }));
  await rejects(f.service.mutate(user, 'group-a', 'expense-1', 'PATCH', {}), /HTTP 403/);
});

test('history preserves category fallback, optional arrays and full-page pagination', async () => {
  const rows = Array.from({ length: 20 }, (_, index) => row(`e${index}`, {
    description: 'Fictif', date: '2026-11-18', amountMinor: 101, currency: 'CAD',
  }));
  const f = fixture(rows);
  const result = await f.service.history('g');
  strictEqual(result.hasMore, true);
  strictEqual(result.last?.id, 'e19');
  strictEqual(result.entries[0].categoryId, 'other');
  strictEqual(result.entries[0].categoryLabel.length > 0, true);
  deepStrictEqual(result.entries[0].payments, []);
  deepStrictEqual(result.entries[0].allocations, []);
  strictEqual(result.entries[0].revision, 0);
  strictEqual(result.entries[0].splitMode, undefined);
  deepStrictEqual(f.calls, ['history:g:::']);
});

test('mutations reject unverified identity, insecure endpoint and disabled Worker', async () => {
  const f = fixture();
  await rejects(f.service.mutate({ ...user, emailVerified: false } as User, 'g', 'e', 'DELETE', {}), /courriel/);
  strictEqual(f.requests.length, 0);
  const insecure = new ExpenseService(app, 'http://worker.example', f.repository);
  await rejects(insecure.mutate(user, 'g', 'e', 'PATCH', {}), /sécurisée/);
  f.reply(Response.json({ error: 'disabled' }, { status: 503 }));
  await rejects(f.service.mutate(user, 'g', 'e', 'DELETE', {}), /désactivée/);
  f.reply(Response.json({ error: 'forbidden' }, { status: 403 }));
  await rejects(f.service.create(user, 'g', {}), /HTTP 403/);
});
