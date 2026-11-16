import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { acceptInvitation, createInvitation, InvitationError } from '../src/invitations';

type Fields = Record<string, { stringValue?: string; timestampValue?: string }>;
async function fixture() {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const docs = new Map<string, Fields>([
    ['groups/g1', { status: { stringValue: 'active' } }],
    ['groups/g1/members/owner', { role: { stringValue: 'owner' }, status: { stringValue: 'active' } }],
  ]);
  const commits: any[][] = [];
  const rollbacks: string[] = [];
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-access' });
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-access');
    if (url.includes(':beginTransaction')) return Response.json({ transaction: 'synthetic-transaction' });
    if (url.includes(':rollback')) {
      rollbacks.push(JSON.parse(String(init?.body)).transaction);
      return Response.json({});
    }
    if (url.includes(':commit')) {
      const writes = JSON.parse(String(init?.body)).writes as any[];
      commits.push(writes);
      for (const write of writes) {
        const path = String(write.update.name).split('/documents/')[1];
        docs.set(path, { ...(write.updateMask ? docs.get(path) : {}), ...write.update.fields });
      }
      return Response.json({ writeResults: writes.map(() => ({})) });
    }
    const path = url.split('/documents/')[1]?.split('?')[0];
    const fields = docs.get(path);
    return fields ? Response.json({ fields }) : new Response(null, { status: 404 });
  };
  return { env, docs, commits, rollbacks, transport: transport as typeof fetch };
}

test('owner creates a hashed, expiring invitation without persisting its token', async () => {
  const f = await fixture();
  const created = await createInvitation({ targetEmail: '  GUEST@EXAMPLE.COM ' }, 'owner', 'g1', f.env, f.transport);
  strictEqual(created.token.length, 43);
  const fields = f.docs.get(`groups/g1/invitations/${created.invitationId}`)!;
  strictEqual(fields['targetEmail'].stringValue, 'guest@example.com');
  strictEqual(fields['tokenHash'].stringValue?.length, 64);
  strictEqual(JSON.stringify(fields).includes(created.token), false);
  strictEqual(f.commits[0][0].currentDocument.exists, false);
  await rejects(createInvitation({}, 'outsider', 'g1', f.env, f.transport), (error: unknown) => error instanceof InvitationError && error.status === 403);
  deepStrictEqual(f.rollbacks, ['synthetic-transaction']);
});

test('redemption writes membership and consumes the invitation in one transaction; replay fails', async () => {
  const f = await fixture();
  const created = await createInvitation({ targetEmail: 'guest@example.com' }, 'owner', 'g1', f.env, f.transport);
  await acceptInvitation(created.token, created.invitationId, 'guest', 'guest@example.com', 'g1', f.env, f.transport);
  strictEqual(f.commits[1].length, 3);
  deepStrictEqual(f.commits[1][0].updateMask.fieldPaths, ['status', 'acceptedBy', 'acceptedAt']);
  strictEqual(f.docs.get('groups/g1/members/guest')?.status.stringValue, 'active');
  strictEqual(f.docs.get('users/guest/groupMemberships/g1')?.status.stringValue, 'active');
  await rejects(acceptInvitation(created.token, created.invitationId, 'other', 'guest@example.com', 'g1', f.env, f.transport), (error: unknown) => error instanceof InvitationError && error.status === 403);
  deepStrictEqual(f.rollbacks, ['synthetic-transaction']);
});

test('wrong email, expired token, wrong token and revoked membership are denied', async () => {
  const f = await fixture();
  const created = await createInvitation({ targetEmail: 'guest@example.com' }, 'owner', 'g1', f.env, f.transport);
  const redeem = (token: string, email: string) => acceptInvitation(token, created.invitationId, 'guest', email, 'g1', f.env, f.transport);
  await rejects(redeem(created.token, 'other@example.com'), (error: unknown) => error instanceof InvitationError && error.code === 'email_mismatch');
  await rejects(redeem('a'.repeat(43), 'guest@example.com'), (error: unknown) => error instanceof InvitationError && error.code === 'invitation_unavailable');
  const path = `groups/g1/invitations/${created.invitationId}`;
  f.docs.get(path)!['expiresAt'] = { timestampValue: '2020-01-01T00:00:00.000Z' };
  await rejects(redeem(created.token, 'guest@example.com'), (error: unknown) => error instanceof InvitationError && error.code === 'invitation_expired');
  f.docs.get(path)!['expiresAt'] = { timestampValue: created.expiresAt };
  f.docs.set('groups/g1/members/guest', { role: { stringValue: 'member' }, status: { stringValue: 'revoked' } });
  await rejects(redeem(created.token, 'guest@example.com'), (error: unknown) => error instanceof InvitationError && error.status === 403);
  strictEqual(f.commits.length, 1);
  strictEqual(f.rollbacks.length, 4);
});
