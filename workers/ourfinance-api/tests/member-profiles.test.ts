import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { listSharedMemberProfiles, MemberProfileError } from '../src/member-profiles';

async function fixture() {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  return { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
}

test('returns only active group members and their display names, never private profile fields', async () => {
  const env = await fixture();
  let memberChecks = 0;
  const transport = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith('/groups/group-a/members/alice') && new Headers(init?.headers).get('Authorization') === 'Bearer id-token') {
      memberChecks++;
      return Response.json({ fields: { role: { stringValue: 'member' }, status: { stringValue: 'active' } } });
    }
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer service-token');
    if (url.includes('/groups/group-a/members?')) return Response.json({ documents: [
      { name: 'projects/ourfinance-test/databases/(default)/documents/groups/group-a/members/alice', fields: { status: { stringValue: 'active' } } },
      { name: 'projects/ourfinance-test/databases/(default)/documents/groups/group-a/members/bob', fields: { status: { stringValue: 'active' } } },
      { name: 'projects/ourfinance-test/databases/(default)/documents/groups/group-a/members/revoked', fields: { status: { stringValue: 'revoked' } } },
    ] });
    if (url.endsWith('/users/alice')) return Response.json({ fields: { displayName: { stringValue: 'Alice Exemple' }, preferredLanguage: { stringValue: 'fr' }, email: { stringValue: 'private@example.test' } } });
    if (url.endsWith('/users/bob')) return new Response(null, { status: 404 });
    throw new Error(url);
  };
  deepStrictEqual(await listSharedMemberProfiles('group-a', 'alice', 'id-token', env, transport as typeof fetch), [
    { userId: 'alice', displayName: 'Alice Exemple' }, { userId: 'bob' },
  ]);
  strictEqual(memberChecks, 2);
});

test('refuses a revoked caller before reading profiles', async () => {
  const env = await fixture();
  let calls = 0;
  const transport = async () => { calls++; return Response.json({ fields: { role: { stringValue: 'member' }, status: { stringValue: 'revoked' } } }); };
  await rejects(listSharedMemberProfiles('group-a', 'alice', 'id-token', env, transport as typeof fetch),
    (error: unknown) => error instanceof MemberProfileError && error.status === 403);
  strictEqual(calls, 1);
});

test('profile listing reports quota exhaustion with a fixed code', async () => {
  const env = await fixture();
  const transport = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith('/groups/group-a/members/alice')) return Response.json({ fields: { role: { stringValue: 'owner' }, status: { stringValue: 'active' } } });
    return Response.json({ message: 'private provider detail' }, { status: 429 });
  };
  await rejects(listSharedMemberProfiles('group-a', 'alice', 'id-token', env, transport as typeof fetch),
    (error: unknown) => error instanceof MemberProfileError && error.status === 503 && error.code === 'provider_quota_exceeded');
});

test('rechecks membership before releasing peer names', async () => {
  const env = await fixture();
  let checks = 0;
  const transport = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith('/groups/group-a/members/alice')) return Response.json({ fields: { role: { stringValue: 'member' }, status: { stringValue: ++checks === 1 ? 'active' : 'revoked' } } });
    if (url.includes('/groups/group-a/members?')) return Response.json({ documents: [{ name: 'projects/x/documents/groups/group-a/members/alice', fields: { status: { stringValue: 'active' } } }] });
    if (url.endsWith('/users/alice')) return Response.json({ fields: { displayName: { stringValue: 'Alice Exemple' } } });
    throw new Error(url);
  };
  await rejects(listSharedMemberProfiles('group-a', 'alice', 'id-token', env, transport as typeof fetch),
    (error: unknown) => error instanceof MemberProfileError && error.status === 403);
  strictEqual(checks, 2);
});

test('bounds active profile reads below the Workers Free subrequest limit', async () => {
  const env = await fixture();
  let profileReads = 0;
  const transport = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith('/groups/group-a/members/alice')) return Response.json({ fields: { role: { stringValue: 'owner' }, status: { stringValue: 'active' } } });
    if (url.includes('/groups/group-a/members?')) return Response.json({ documents: Array.from({ length: 31 }, (_, index) => ({
      name: `projects/x/documents/groups/group-a/members/member${index}`, fields: { status: { stringValue: 'active' } },
    })) });
    if (url.includes('/users/')) profileReads++;
    throw new Error(url);
  };
  await rejects(listSharedMemberProfiles('group-a', 'alice', 'id-token', env, transport as typeof fetch),
    (error: unknown) => error instanceof MemberProfileError && error.status === 413);
  strictEqual(profileReads, 0);
});

test('profile list omits blank or excessive names and rejects invalid member paths', async () => {
  const env = await fixture();
  for (const name of ['   ', 'x'.repeat(81)]) {
    const transport = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
      if (url.endsWith('/groups/group-a/members/alice')) return Response.json({ fields: { role: { stringValue: 'member' }, status: { stringValue: 'active' } } });
      if (url.includes('/groups/group-a/members?')) return Response.json({ documents: [{ name: 'projects/x/documents/groups/group-a/members/alice', fields: { status: { stringValue: 'active' } } }] });
      if (url.endsWith('/users/alice')) return Response.json({ fields: { displayName: { stringValue: name } } });
      throw new Error(url);
    }) as typeof fetch;
    deepStrictEqual(await listSharedMemberProfiles('group-a', 'alice', 'id-token', env, transport), [{ userId: 'alice' }]);
  }
  const invalid = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith('/groups/group-a/members/alice')) return Response.json({ fields: { role: { stringValue: 'member' }, status: { stringValue: 'active' } } });
    if (url.includes('/groups/group-a/members?')) return Response.json({ documents: [{ name: 'projects/x/documents/groups/group-a/members/bad%id', fields: { status: { stringValue: 'active' } } }] });
    throw new Error(url);
  }) as typeof fetch;
  await rejects(listSharedMemberProfiles('group-a', 'alice', 'id-token', env, invalid),
    (error: unknown) => error instanceof MemberProfileError && error.code === 'member_invalid');
});

test('member profiles page safely and reject an unavailable private profile', async () => {
  const env = await fixture();
  let pages = 0;
  const transport = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith('/groups/group-a/members/alice')) return Response.json({ fields: { role: { stringValue: 'owner' }, status: { stringValue: 'active' } } });
    if (url.includes('/groups/group-a/members?')) {
      pages++;
      return pages === 1 ? Response.json({ documents: [], nextPageToken: 'next' }) : Response.json({ documents: [
        { name: 'projects/x/documents/groups/group-a/members/alice', fields: { status: { stringValue: 'active' } } },
      ] });
    }
    if (url.endsWith('/users/alice')) return Response.json({}, { status: 503 });
    throw new Error(url);
  }) as typeof fetch;
  await rejects(listSharedMemberProfiles('group-a', 'alice', 'id-token', env, transport),
    (error: unknown) => error instanceof MemberProfileError && error.code === 'profile_unavailable');
  strictEqual(pages, 2);
});

test('member profile listing stops after five pages even if Firestore keeps returning a cursor', async () => {
  const env = await fixture();
  let pages = 0;
  const transport = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith('/groups/group-a/members/alice')) return Response.json({ fields: { role: { stringValue: 'owner' }, status: { stringValue: 'active' } } });
    if (url.includes('/groups/group-a/members?')) { pages++; return Response.json({ documents: [], nextPageToken: `page_${pages}` }); }
    throw new Error(url);
  }) as typeof fetch;
  await rejects(listSharedMemberProfiles('group-a', 'alice', 'id-token', env, transport),
    (error: unknown) => error instanceof MemberProfileError && error.code === 'group_too_large');
  strictEqual(pages, 5);
});
