import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { loadSharedMemberProfiles } from '../../src/app/core/firebase/member-profile-service';
import type { User } from 'firebase/auth';

const user = { emailVerified: true, getIdToken: async () => 'synthetic-token' } as User;

test('loads only bounded shared member names from the selected group', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    strictEqual(String(input), 'https://api.example.test/groups/group-a/member-profiles');
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-token');
    return Response.json({ members: [
      { userId: 'alice', displayName: 'Alice Exemple' },
      { userId: 'bob' },
      { userId: 'bad/id', displayName: 'Wrong' },
      { userId: 'third', displayName: 'x'.repeat(81) },
    ] });
  }) as typeof fetch;
  try { deepStrictEqual(await loadSharedMemberProfiles('https://api.example.test', 'group-a', user), [
    { userId: 'alice', displayName: 'Alice Exemple' }, { userId: 'bob' },
  ]); } finally { globalThis.fetch = previous; }
});

test('keeps neutral labels when the test route is disabled', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
  try { deepStrictEqual(await loadSharedMemberProfiles('https://api.example.test', 'group-a', user), []); }
  finally { globalThis.fetch = previous; }
});
