import { test } from 'node:test';
import { strictEqual, deepStrictEqual } from 'node:assert';
import { readMember } from '../src/firestore';

test('membership read uses caller token and group-scoped document', async () => {
  let called = '';
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    called = String(input);
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer id-token');
    return Response.json({ fields: { role: { stringValue: 'member' }, status: { stringValue: 'active' } } });
  };
  deepStrictEqual(await readMember('project', 'group-1', 'alice', 'id-token', transport as typeof fetch), { role: 'member', status: 'active' });
  strictEqual(called.endsWith('/groups/group-1/members/alice'), true);
});
