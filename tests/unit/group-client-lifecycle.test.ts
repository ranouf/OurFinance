import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { GroupService, GroupLifecycleRequestError, type GroupRepository } from '../../src/app/core/firebase/group-service';
import { CategoryService, type CategoryDraft, type CategoryRepository } from '../../src/app/core/firebase/category-service';
import { categoryColors, categoryIcons } from '../../src/app/shared/utils/categories';

const app = {} as FirebaseApp;
const user = { uid: 'owner', emailVerified: true, getIdToken: async () => 'fixture-token' } as User;
const emptyGroups: GroupRepository = { memberships: async () => [], group: async () => { throw new Error('unused'); }, memberCount: async () => 0 };

test('group client revokes a member and archives only through scoped authenticated Worker routes', async () => {
  const requests: { path: string; method: string; auth: string | null }[] = [];
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ path: String(input), method: init?.method ?? 'GET', auth: new Headers(init?.headers).get('Authorization') });
    return new Response(null, { status: 204 });
  };
  const service = new GroupService(app, 'https://worker.example', emptyGroups, transport as typeof fetch);
  await service.revokeMember(user, 'group-a', 'member-b');
  await service.archive(user, 'group-a');
  deepStrictEqual(requests, [
    { path: 'https://worker.example/groups/group-a/members/member-b/revoke', method: 'POST', auth: 'Bearer fixture-token' },
    { path: 'https://worker.example/groups/group-a/archive', method: 'POST', auth: 'Bearer fixture-token' },
  ]);
});

test('group client refuses invalid identity and preserves lifecycle error status/code', async () => {
  let calls = 0;
  const transport = async () => { calls++; return Response.json({ error: 'member_inactive' }, { status: 409 }); };
  const service = new GroupService(app, 'https://worker.example', emptyGroups, transport);
  await rejects(service.revokeMember(user, 'group-a', '../bad'), /invalide/);
  await rejects(service.archive({ ...user, emailVerified: false } as User, 'group-a'), /indisponible/);
  await rejects(service.archive(user, '../bad'), /indisponible/);
  strictEqual(calls, 0);
  await rejects(service.revokeMember(user, 'group-a', 'member-b'),
    (error: unknown) => error instanceof GroupLifecycleRequestError && error.status === 409 && error.code === 'member_inactive');
  const insecure = new GroupService(app, 'http://worker.example', emptyGroups, transport);
  await rejects(insecure.archive(user, 'group-a'), /sécurisée/);
});

test('category client sorts a group catalogue and preserves archived entries for history', async () => {
  const row = (id: string, data: Record<string, unknown>) => ({ id, data: () => data }) as QueryDocumentSnapshot<DocumentData>;
  const repository: CategoryRepository = { list: async () => ({ docs: [
    row('b', { name: 'Voyage', iconId: categoryIcons[0].id, color: categoryColors[0].id, status: 'archived' }),
    row('a', { name: 'Épicerie', iconId: categoryIcons[0].id, color: categoryColors[0].id, status: 'active' }),
  ] }) as QuerySnapshot<DocumentData> };
  const service = new CategoryService(app, 'https://worker.example', repository);
  const rows = await service.list('group-a');
  deepStrictEqual(rows.map(item => [item.id, item.label, item.status]), [['a', 'Épicerie', 'active'], ['b', 'Voyage', 'archived']]);
});

test('category client creates, archives and reactivates through Worker with verified identity', async () => {
  const repository: CategoryRepository = { list: async () => ({ docs: [] }) as QuerySnapshot<DocumentData> };
  const calls: { path: string; method: string; auth: string | null; body: Record<string, unknown> }[] = [];
  let status = 204;
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(input), method: init?.method ?? 'GET', auth: new Headers(init?.headers).get('Authorization'),
      body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(null, { status });
  };
  const service = new CategoryService(app, 'https://worker.example', repository, transport as typeof fetch);
  const draft: CategoryDraft = { name: 'Fictif', iconId: categoryIcons[0].id, color: categoryColors[0].id, status: 'active' };
  const id = await service.create(user, 'group-a', draft);
  await service.update(user, 'group-a', id, { ...draft, status: 'archived' });
  await service.update(user, 'group-a', id, draft);
  deepStrictEqual(calls.map(item => [item.method, item.path, item.auth, item.body['status']]), [
    ['POST', 'https://worker.example/groups/group-a/categories', 'Bearer fixture-token', 'active'],
    ['PATCH', `https://worker.example/groups/group-a/categories/${id}`, 'Bearer fixture-token', 'archived'],
    ['PATCH', `https://worker.example/groups/group-a/categories/${id}`, 'Bearer fixture-token', 'active'],
  ]);
  await rejects(service.create({ ...user, emailVerified: false } as User, 'group-a', draft), /courriel/);
  status = 503;
  await rejects(service.update(user, 'group-a', id, draft), /désactivée/);
});
