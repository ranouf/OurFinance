import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QuerySnapshot } from 'firebase/firestore';
import { GroupService, type GroupRepository } from '../../src/app/core/firebase/group-service';

const user = { emailVerified: true, getIdToken: async () => 'fictional-token' } as User;
const repository: GroupRepository = {
  memberships: async () => [], group: async () => { throw new Error('unused'); }, memberCount: async () => 0,
  members: async () => ({ docs: [
    { id: 'owner', data: () => ({ role: 'owner', status: 'active' }) },
    { id: 'member-a', data: () => ({ role: 'member', status: 'active' }) },
    { id: 'member-b', data: () => ({ role: 'member', status: 'revoked' }) },
  ] }) as QuerySnapshot<DocumentData>,
};

test('group service lists active and revoked members without exposing another group', async () => {
  const members = await new GroupService({} as FirebaseApp, 'https://worker.example', repository).members('group-a');
  deepStrictEqual(members, [
    { userId: 'owner', role: 'owner', status: 'active' },
    { userId: 'member-a', role: 'member', status: 'active' },
    { userId: 'member-b', role: 'member', status: 'revoked' },
  ]);
});

test('group lifecycle sends authenticated requests to the selected group only', async () => {
  const calls: string[] = [];
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(`${init?.method} ${String(input)} ${(init?.headers as Record<string, string>).Authorization}`);
    return new Response(null, { status: 204 });
  };
  const service = new GroupService({} as FirebaseApp, 'https://worker.example', repository, transport as typeof fetch);
  await service.revokeMember(user, 'group_a', 'member_b');
  await service.archive(user, 'group_a');
  strictEqual(calls[0], 'POST https://worker.example/groups/group_a/members/member_b/revoke Bearer fictional-token');
  strictEqual(calls[1], 'POST https://worker.example/groups/group_a/archive Bearer fictional-token');
});

test('group lifecycle preserves server refusal and rejects unverified sessions', async () => {
  let response = new Response(JSON.stringify({ error: 'owner_required' }), { status: 403 });
  const transport = async () => response;
  const service = new GroupService({} as FirebaseApp, 'https://worker.example', repository, transport as typeof fetch);
  await rejects(service.archive(user, 'group_a'), /owner_required/);
  await rejects(service.revokeMember({ ...user, emailVerified: false } as User, 'group_a', 'member_b'), /Cycle de vie indisponible/);
  await rejects(service.revokeMember(user, 'group_a', '../member-b'), /Identifiant membre invalide/);
  response = new Response(JSON.stringify({ error: 'Cycle de vie non configuré' }), { status: 503 });
  await rejects(service.archive(user, 'group_a'), { status: 503 });
});
