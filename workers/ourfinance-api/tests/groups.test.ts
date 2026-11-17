import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createGroup, validateNewGroup } from '../src/groups';

test('group creation validates name and ISO currency', () => {
  deepStrictEqual(validateNewGroup({ name: '  Personnel ', currency: 'CAD' }), { name: 'Personnel', currency: 'CAD' });
  throws(() => validateNewGroup({ name: 'x', currency: 'ZZZ' }));
  throws(() => validateNewGroup({ name: '', currency: 'CAD' }));
});
test('group, owner and personal reference are committed atomically', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const account = JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) });
  let writes: any[] = [];
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes('oauth2.googleapis.com')) return Response.json({ access_token: 'test-access' });
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer test-access');
    writes = JSON.parse(String(init?.body)).writes;
    return Response.json({ writeResults: [{}, {}, {}] });
  };
  const groupId = await createGroup({ name: 'Personnel', currency: 'JPY' }, 'alice', { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: account }, transport as typeof fetch);
  strictEqual(writes.length, 3);
  strictEqual(writes.every(write => write.currentDocument.exists === false), true);
  strictEqual(writes[0].update.name.endsWith(`/groups/${groupId}`), true);
  strictEqual(writes[1].update.name.endsWith(`/groups/${groupId}/members/alice`), true);
  strictEqual(writes[2].update.name.endsWith(`/users/alice/groupMemberships/${groupId}`), true);
});
