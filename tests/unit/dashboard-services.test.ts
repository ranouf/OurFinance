import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { FirebaseError, type FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { GroupService, type GroupRepository } from '../../src/app/core/firebase/group-service';
import { BalanceService, type BalanceRepository } from '../../src/app/core/firebase/balance-service';
import { loadSharedMemberProfiles } from '../../src/app/core/firebase/member-profile-service';

const app = {} as FirebaseApp;
const user = { uid: 'alice', emailVerified: true, getIdToken: async () => 'fixture-token' } as User;
const row = (id: string, data: Record<string, unknown>) => ({ id, data: () => data }) as QueryDocumentSnapshot<DocumentData>;
const page = (docs: QueryDocumentSnapshot<DocumentData>[]) => ({ docs, size: docs.length }) as QuerySnapshot<DocumentData>;
const document = (id: string, data?: Record<string, unknown>) => ({ id, exists: () => data !== undefined,
  data: () => data }) as DocumentSnapshot<DocumentData>;

test('group list follows the user memberships, drops revoked references and keeps archived state', async () => {
  const calls: string[] = [];
  const repository: GroupRepository = {
    memberships: async (_app, uid) => { calls.push(`memberships:${uid}`); return ['active', 'archived', 'revoked', 'missing']; },
    group: async (_app, id) => {
      calls.push(`group:${id}`);
      if (id === 'revoked') throw new FirebaseError('permission-denied', 'revoked');
      if (id === 'missing') return document(id);
      return document(id, { name: id, currencyCode: id === 'active' ? 'CAD' : 'JPY', ownerId: 'alice',
        status: id === 'archived' ? 'archived' : 'active', currencyLockedAt: id === 'archived' ? 'now' : null });
    },
    memberCount: async (_app, id) => { calls.push(`count:${id}`); if (id === 'archived') throw new Error('count unavailable'); return 1; },
  };
  const groups = await new GroupService(app, 'https://worker.example', repository).list(user);
  deepStrictEqual(groups, [
    { id: 'active', name: 'active', currency: 'CAD', ownerId: 'alice', status: 'active', currencyLocked: false, memberCount: 1 },
    { id: 'archived', name: 'archived', currency: 'JPY', ownerId: 'alice', status: 'archived', currencyLocked: true },
  ]);
  strictEqual(calls.includes('memberships:alice'), true);
});

test('group write methods send verified identity and report currency lock without a direct Firestore write', async () => {
  const calls: { url: string; method: string; body: unknown; authorization: string | null }[] = [];
  let reply: Response = Response.json({ groupId: 'group-a' });
  const repository: GroupRepository = { memberships: async () => [], group: async () => document('x'), memberCount: async () => 0 };
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET', body: JSON.parse(String(init?.body)),
      authorization: new Headers(init?.headers).get('Authorization') });
    return reply;
  };
  const service = new GroupService(app, 'https://worker.example', repository, transport as typeof fetch);
  strictEqual(await service.create(user, 'Fixture', 'CAD'), 'group-a');
  reply = new Response(null, { status: 204 });
  await service.changeCurrency(user, 'group-a', 'JPY');
  deepStrictEqual(calls.map(call => [call.method, call.url, call.body, call.authorization]), [
    ['POST', 'https://worker.example/groups', { name: 'Fixture', currency: 'CAD' }, 'Bearer fixture-token'],
    ['PATCH', 'https://worker.example/groups/group-a/currency', { currencyCode: 'JPY' }, 'Bearer fixture-token'],
  ]);
  reply = new Response(null, { status: 403 });
  await rejects(service.changeCurrency(user, 'group-a', 'EUR'), /currency_locked/);
  await rejects(service.create({ ...user, emailVerified: false } as User, 'x', 'CAD'), /indisponible/);
  await rejects(service.changeCurrency(user, '../other', 'EUR'), /indisponible/);
});

test('group service drops malformed rows, preserves unexpected read failures and rejects malformed Worker results', async () => {
  const repository: GroupRepository = {
    memberships: async () => ['malformed', 'boom'],
    group: async (_app, id) => id === 'boom' ? Promise.reject(new Error('network failed')) : document(id, { name: 12, currencyCode: 'CAD' }),
    memberCount: async () => 1,
  };
  const service = new GroupService(app, 'https://worker.example', repository, async () => Response.json({}));
  await rejects(service.list(user), /network failed/);
  repository.memberships = async () => ['malformed'];
  deepStrictEqual(await service.list(user), []);
  await rejects(service.create(user, 'Fixture', 'CAD'), /invalide/);
  const insecure = new GroupService(app, 'http://worker.example', repository, async () => Response.json({ groupId: 'g' }));
  await rejects(insecure.create(user, 'Fixture', 'CAD'), /sécurisée/);
  await rejects(insecure.changeCurrency(user, 'group-a', 'EUR'), /sécurisée/);
  const disabled = new GroupService(app, 'https://worker.example', repository, async () => new Response(null, { status: 503 }));
  await rejects(disabled.changeCurrency(user, 'group-a', 'EUR'), /currency_disabled/);
});

test('balance service ignores deleted entries, reports incomplete data and derives exact group totals', async () => {
  const calls: string[] = [];
  const repository: BalanceRepository = {
    expenses: async (_app, groupId) => { calls.push(`expenses:${groupId}`); return page([
      row('deleted', { deleted: true }), row('broken', { amountMinor: 999 }),
      row('expense', { currency: 'CAD', date: '2026-11-18', amountMinor: 101, categoryId: 'food',
        payments: [{ userId: 'alice', amountMinor: 101 }], allocations: [{ userId: 'alice', amountMinor: 50 }, { userId: 'bob', amountMinor: 51 }] }),
    ]); },
    settlements: async (_app, groupId) => { calls.push(`settlements:${groupId}`); return page([
      row('deleted', { deleted: true }), row('settlement', { currency: 'CAD', date: '2026-11-18', amountMinor: 20,
        fromUserId: 'bob', toUserId: 'alice' }),
    ]); },
  };
  const service = new BalanceService(app, repository);
  const entries = await service.entries('group-a');
  strictEqual(entries.expenses.length, 1);
  strictEqual(entries.settlements.length, 1);
  strictEqual(entries.incompleteCount, 1);
  const result = await service.load('group-a');
  deepStrictEqual(result.totals.map(item => [item.userId, item.balanceMinor]), [['alice', 31n], ['bob', -31n]]);
  deepStrictEqual(calls, ['expenses:group-a', 'settlements:group-a', 'expenses:group-a', 'settlements:group-a']);
});

test('shared member profiles expose only valid active peer names through HTTPS Worker', async () => {
  const calls: string[] = [];
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(`${String(input)}:${new Headers(init?.headers).get('Authorization')}`);
    return Response.json({ members: [{ userId: 'alice', displayName: 'Alice' }, { userId: 'bad space', displayName: 'No' },
      { userId: 'bob', displayName: 'X'.repeat(81) }, { userId: 'carol' }] });
  };
  deepStrictEqual(await loadSharedMemberProfiles('https://worker.example', 'group-a', user, transport as typeof fetch),
    [{ userId: 'alice', displayName: 'Alice' }, { userId: 'carol' }]);
  deepStrictEqual(calls, ['https://worker.example/groups/group-a/member-profiles:Bearer fixture-token']);
  deepStrictEqual(await loadSharedMemberProfiles('https://worker.example', '../bad', user, transport as typeof fetch), []);
  deepStrictEqual(await loadSharedMemberProfiles('http://worker.example', 'group-a', user, transport as typeof fetch), []);
  deepStrictEqual(await loadSharedMemberProfiles('https://worker.example', 'group-a',
    { ...user, emailVerified: false } as User, transport as typeof fetch), []);
  strictEqual(calls.length, 1);
});
