import { withBatchGet } from './batch-get-mock';
import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { changeGroupLifecycle, GroupLifecycleError } from '../src/group-lifecycle';

const root = 'projects/ourfinance-test/databases/(default)/documents';
async function fixture(options: { actorRole?: string; groupStatus?: string; targetStatus?: string; targetRole?: string; conflict?: boolean } = {}) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'fixture@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  let writes: Record<string, any>[] = [];
  let commits = 0;
  let rollbacks = 0;
  const document = (fields: Record<string, string>) => Response.json({
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: value }])),
  });
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'fixture-access' });
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer fixture-access');
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'fixture-transaction' });
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.endsWith(':commit')) {
      commits++;
      const body = JSON.parse(String(init?.body));
      strictEqual(body.transaction, 'fixture-transaction');
      writes = body.writes;
      return Response.json({}, { status: options.conflict ? 409 : 200 });
    }
    if (url.includes('/groups/g/members/owner?transaction=')) return document({ role: options.actorRole ?? 'owner', status: 'active' });
    if (url.includes('/groups/g/members/member?transaction=')) return document({ role: options.targetRole ?? 'member', status: options.targetStatus ?? 'active' });
    if (url.includes('/groups/g?transaction=')) return document({ status: options.groupStatus ?? 'active' });
    throw new Error('Unexpected Firestore request');
  };
  return { env, transport: withBatchGet(transport), get writes() { return writes; }, get commits() { return commits; }, get rollbacks() { return rollbacks; } };
}

test('owner revokes member and personal reference atomically without deleting history', async () => {
  const state = await fixture();
  await changeGroupLifecycle('revoke_member', 'g', 'owner', 'member', state.env, state.transport);
  strictEqual(state.commits, 1);
  strictEqual(state.rollbacks, 0);
  strictEqual(state.writes.length, 3);
  deepStrictEqual(state.writes.slice(0, 2).map(write => write.update.name), [
    root + '/groups/g/members/member', root + '/users/member/groupMemberships/g',
  ]);
  strictEqual(state.writes[0].update.fields.status.stringValue, 'revoked');
  strictEqual(state.writes[1].update.fields.status.stringValue, 'revoked');
  strictEqual(state.writes[2].update.fields.action.stringValue, 'member_revoked');
  strictEqual(state.writes.some(write => write.delete), false);
});

test('owner archives group without deleting transactions', async () => {
  const state = await fixture();
  await changeGroupLifecycle('archive_group', 'g', 'owner', undefined, state.env, state.transport);
  strictEqual(state.writes.length, 2);
  strictEqual(state.writes[0].update.name, root + '/groups/g');
  strictEqual(state.writes[0].update.fields.status.stringValue, 'archived');
  strictEqual(state.writes[1].update.fields.action.stringValue, 'group_archived');
  strictEqual(state.writes.some(write => write.delete), false);
});

test('member, archived group and self-revocation are refused', async () => {
  for (const options of [{ actorRole: 'member' }, { groupStatus: 'archived' }]) {
    const state = await fixture(options);
    await rejects(changeGroupLifecycle('revoke_member', 'g', 'owner', 'member', state.env, state.transport),
      error => error instanceof GroupLifecycleError && error.status === 403);
    strictEqual(state.commits, 0);
    strictEqual(state.rollbacks, 1);
  }
  const state = await fixture();
  await rejects(changeGroupLifecycle('revoke_member', 'g', 'owner', 'owner', state.env, state.transport),
    error => error instanceof GroupLifecycleError && error.status === 403);
  strictEqual(state.commits, 0);
});

test('repeat revocation and conflicting commit keep a single outcome', async () => {
  const inactive = await fixture({ targetStatus: 'revoked' });
  await rejects(changeGroupLifecycle('revoke_member', 'g', 'owner', 'member', inactive.env, inactive.transport),
    error => error instanceof GroupLifecycleError && error.status === 409);
  strictEqual(inactive.commits, 0);
  const conflict = await fixture({ conflict: true });
  await rejects(changeGroupLifecycle('archive_group', 'g', 'owner', undefined, conflict.env, conflict.transport),
    error => error instanceof GroupLifecycleError && error.status === 409);
  strictEqual(conflict.rollbacks, 1);
});
