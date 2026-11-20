import { withBatchGet } from './batch-get-mock';
import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { acceptQrInvitation, createQrInvitation, listQrInvitations, previewQrInvitation, revokeQrInvitation, QrInvitationError } from '../src/qr-invitations';

type Fields = Record<string, { stringValue?: string; timestampValue?: string; integerValue?: string }>;
async function fixture() {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', QR_INVITATION_POC_GROUP_ID: 'g1', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const docs = new Map<string, Fields>([
    ['groups/g1', { name: { stringValue: 'Fictional group' }, currency: { stringValue: 'CAD' }, status: { stringValue: 'active' } }],
    ['groups/g1/members/owner', { role: { stringValue: 'owner' }, status: { stringValue: 'active' } }],
  ]);
  const commits: Array<Array<Record<string, any>>> = [];
  const rollbacks: string[] = [];
  let conflictNextCommit = false;
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-access' });
    strictEqual(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-access');
    if (url.includes(':beginTransaction')) return Response.json({ transaction: 'synthetic-transaction' });
    if (url.includes(':rollback')) { rollbacks.push('synthetic-transaction'); return Response.json({}); }
    if (url.includes(':commit')) {
      if (conflictNextCommit) { conflictNextCommit = false; return new Response(null, { status: 409 }); }
      const writes = JSON.parse(String(init?.body)).writes as Array<Record<string, any>>;
      commits.push(writes);
      for (const write of writes) {
        if (write.delete) { docs.delete(String(write.delete).split('/documents/')[1]); continue; }
        const path = String(write.update.name).split('/documents/')[1];
        docs.set(path, { ...(write.updateMask ? docs.get(path) : {}), ...write.update.fields });
      }
      return Response.json({ writeResults: writes.map(() => ({})) });
    }
    if (url.includes('/groups/g1/invitations?')) return Response.json({ documents: [...docs.entries()].filter(([path]) => path.startsWith('groups/g1/invitations/')).map(([path, fields]) => ({ name: `projects/ourfinance-test/databases/(default)/documents/${path}`, fields })) });
    const path = url.split('/documents/')[1]?.split('?')[0];
    const fields = docs.get(path);
    return fields ? Response.json({ fields }) : new Response(null, { status: 404 });
  };
  return { env, docs, commits, rollbacks, transport: withBatchGet(transport), conflict: () => { conflictNextCommit = true; } };
}

test('QR invitation stores only a hash and a server-only lookup, expires after 24 h', async () => {
  const f = await fixture();
  const created = await createQrInvitation({ targetEmail: ' GUEST@EXAMPLE.COM ' }, 'owner', 'g1', f.env, f.transport);
  strictEqual(created.token.length, 43);
  const invite = f.docs.get(`groups/g1/invitations/${created.invitationId}`)!;
  strictEqual(invite['targetEmail'].stringValue, 'guest@example.com');
  strictEqual(invite['maxUses'].integerValue, '1');
  strictEqual(Date.parse(created.expiresAt) - Date.now() > 23 * 60 * 60 * 1000, true);
  strictEqual(f.commits[0].length, 2);
  strictEqual([...f.docs.keys()].some(path => path.startsWith('invitationTokens/')), true);
  strictEqual(JSON.stringify([...f.docs.values()]).includes(created.token), false);
  await rejects(createQrInvitation({}, 'outsider', 'g1', f.env, f.transport), (error: unknown) => error instanceof QrInvitationError && error.code === 'owner_required');
  deepStrictEqual(f.rollbacks, ['synthetic-transaction']);
});

test('V1 QR invitations support two groups while preserving owner checks and isolated preview', async () => {
  const f = await fixture();
  const v1 = { ...f.env, QR_INVITATION_POC_GROUP_ID: undefined };
  f.docs.set('groups/g2', { name: { stringValue: 'Other fictional group' }, currency: { stringValue: 'JPY' }, status: { stringValue: 'active' } });
  f.docs.set('groups/g2/members/owner', { role: { stringValue: 'owner' }, status: { stringValue: 'active' } });
  const first = await createQrInvitation({}, 'owner', 'g1', v1, f.transport);
  const second = await createQrInvitation({}, 'owner', 'g2', v1, f.transport);
  strictEqual((await previewQrInvitation(first.token, 'guest', 'guest@example.com', v1, f.transport)).groupName, 'Fictional group');
  strictEqual((await previewQrInvitation(second.token, 'guest', 'guest@example.com', v1, f.transport)).groupName, 'Other fictional group');
  await rejects(createQrInvitation({}, 'outsider', 'g2', v1, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.code === 'owner_required');
  await rejects(previewQrInvitation(second.token, 'guest', 'guest@example.com', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 403);
});

test('concurrent acceptance conflict rolls back without a partial membership', async () => {
  const f = await fixture();
  const created = await createQrInvitation({}, 'owner', 'g1', f.env, f.transport);
  f.conflict();
  await rejects(acceptQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport), (error: unknown) => error instanceof QrInvitationError && error.status === 409);
  strictEqual(f.docs.has('groups/g1/members/guest'), false);
  strictEqual(f.docs.get(`groups/g1/invitations/${created.invitationId}`)?.status.stringValue, 'active');
  deepStrictEqual(f.rollbacks, ['synthetic-transaction']);
});

test('preview is read-only; acceptance creates one member, replay and outsiders fail', async () => {
  const f = await fixture();
  const created = await createQrInvitation({}, 'owner', 'g1', f.env, f.transport);
  const beforePreview = f.commits.length;
  const preview = await previewQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport);
  deepStrictEqual(preview, { groupName: 'Fictional group', currency: 'CAD', expiresAt: created.expiresAt });
  strictEqual(f.commits.length, beforePreview);
  await rejects(previewQrInvitation(created.token, 'guest', 'guest@example.com', { ...f.env, QR_INVITATION_POC_GROUP_ID: 'g2' }, f.transport), (error: unknown) => error instanceof QrInvitationError && error.status === 403);
  strictEqual(await acceptQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport), 'g1');
  strictEqual(f.commits[1].length, 4);
  strictEqual(f.docs.get('groups/g1/members/guest')?.role.stringValue, 'member');
  strictEqual([...f.docs.keys()].some(path => path.startsWith('invitationTokens/')), false);
  await rejects(acceptQrInvitation(created.token, 'other', 'other@example.com', f.env, f.transport), (error: unknown) => error instanceof QrInvitationError && error.status === 403);
});

test('target email, expiry and revocation deny access without consuming the invitation', async () => {
  const f = await fixture();
  const created = await createQrInvitation({ targetEmail: 'guest@example.com' }, 'owner', 'g1', f.env, f.transport);
  await rejects(previewQrInvitation(created.token, 'other', 'other@example.com', f.env, f.transport), (error: unknown) => error instanceof QrInvitationError && error.status === 403);
  await rejects(acceptQrInvitation(created.token, 'other', 'other@example.com', f.env, f.transport), (error: unknown) => error instanceof QrInvitationError && error.status === 403);
  strictEqual(f.commits.length, 1);
  const invite = f.docs.get(`groups/g1/invitations/${created.invitationId}`)!;
  invite['expiresAt'] = { timestampValue: '2020-01-01T00:00:00.000Z' };
  await rejects(previewQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport), (error: unknown) => error instanceof QrInvitationError && error.code === 'invitation_expired');
  invite['expiresAt'] = { timestampValue: created.expiresAt };
  await revokeQrInvitation(created.invitationId, 'owner', 'g1', f.env, f.transport);
  strictEqual(f.docs.get(`groups/g1/invitations/${created.invitationId}`)?.status.stringValue, 'revoked');
  strictEqual([...f.docs.keys()].some(path => path.startsWith('invitationTokens/')), false);
  await rejects(previewQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport), (error: unknown) => error instanceof QrInvitationError && error.status === 403);
  strictEqual(f.docs.has('groups/g1/members/guest'), false);
});

test('only the owner lists invitation metadata, never a token or hash', async () => {
  const f = await fixture();
  const created = await createQrInvitation({ targetEmail: 'guest@example.com' }, 'owner', 'g1', f.env, f.transport);
  const result = await listQrInvitations('g1', 'owner', f.env, '', f.transport);
  strictEqual(result.invitations.length, 1);
  strictEqual(result.invitations[0].invitationId, created.invitationId);
  strictEqual(result.invitations[0].targetEmail, 'guest@example.com');
  strictEqual(JSON.stringify(result).includes('tokenHash'), false);
  strictEqual(JSON.stringify(result).includes(created.token), false);
  await rejects(listQrInvitations('g1', 'guest', f.env, '', f.transport), (error: unknown) => error instanceof QrInvitationError && error.status === 403);
});

test('owner listing expires a bounded invitation and removes its server-only token index', async () => {
  const f = await fixture();
  const created = await createQrInvitation({}, 'owner', 'g1', f.env, f.transport);
  f.docs.get(`groups/g1/invitations/${created.invitationId}`)!['expiresAt'] = { timestampValue: '2020-01-01T00:00:00.000Z' };
  const listed = await listQrInvitations('g1', 'owner', f.env, '', f.transport);
  strictEqual(listed.invitations[0].status, 'expired');
  strictEqual(f.docs.get(`groups/g1/invitations/${created.invitationId}`)?.status.stringValue, 'expired');
  strictEqual([...f.docs.keys()].some(path => path.startsWith('invitationTokens/')), false);
  strictEqual(f.commits[1].length, 2);
  await rejects(previewQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 403);
});

test('expiry cleanup tolerates a concurrent transaction conflict and retries on the next owner listing', async () => {
  const f = await fixture();
  const created = await createQrInvitation({}, 'owner', 'g1', f.env, f.transport);
  f.docs.get(`groups/g1/invitations/${created.invitationId}`)!['expiresAt'] = { timestampValue: '2020-01-01T00:00:00.000Z' };
  f.conflict();
  strictEqual((await listQrInvitations('g1', 'owner', f.env, '', f.transport)).invitations[0].status, 'expired');
  strictEqual(f.docs.get(`groups/g1/invitations/${created.invitationId}`)?.status.stringValue, 'active');
  strictEqual([...f.docs.keys()].some(path => path.startsWith('invitationTokens/')), true);
  strictEqual(f.rollbacks.length, 1);
  await listQrInvitations('g1', 'owner', f.env, '', f.transport);
  strictEqual(f.docs.get(`groups/g1/invitations/${created.invitationId}`)?.status.stringValue, 'expired');
  strictEqual([...f.docs.keys()].some(path => path.startsWith('invitationTokens/')), false);
});

test('QR input rejects malformed target email, group scope and token before storage', async () => {
  const f = await fixture();
  for (const targetEmail of [42, 'bad', `${'x'.repeat(255)}@example.com`]) {
    await rejects(createQrInvitation({ targetEmail }, 'owner', 'g1', f.env, f.transport),
      (error: unknown) => error instanceof QrInvitationError && error.status === 400);
  }
  await rejects(createQrInvitation({}, 'bad/uid', 'g1', f.env, f.transport), QrInvitationError);
  await rejects(createQrInvitation({}, 'owner', 'g2', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 403);
  await rejects(previewQrInvitation('short', 'guest', 'guest@example.com', f.env, f.transport), QrInvitationError);
  await rejects(acceptQrInvitation(123, 'guest', 'guest@example.com', f.env, f.transport), QrInvitationError);
  await rejects(revokeQrInvitation('bad/id', 'owner', 'g1', f.env, f.transport), QrInvitationError);
  await rejects(listQrInvitations('g1', 'owner', f.env, 'x'.repeat(1025), f.transport), QrInvitationError);
  strictEqual(f.commits.length, 0);
});

test('existing active and revoked members cannot consume a new invitation', async () => {
  const f = await fixture();
  const created = await createQrInvitation({}, 'owner', 'g1', f.env, f.transport);
  f.docs.set('groups/g1/members/guest', { role: { stringValue: 'member' }, status: { stringValue: 'active' } });
  await rejects(previewQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 409);
  await rejects(acceptQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 409);
  f.docs.get('groups/g1/members/guest')!['status'] = { stringValue: 'revoked' };
  await rejects(previewQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 403);
  await rejects(acceptQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 403);
  strictEqual(f.commits.length, 1);
});

test('revoking an already accepted invitation never rewrites membership', async () => {
  const f = await fixture();
  const created = await createQrInvitation({}, 'owner', 'g1', f.env, f.transport);
  await acceptQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport);
  await rejects(revokeQrInvitation(created.invitationId, 'owner', 'g1', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 409);
  strictEqual(f.docs.get('groups/g1/members/guest')?.status.stringValue, 'active');
});

test('QR preview and revocation reject stale token pointers and malformed expiry metadata', async () => {
  const f = await fixture();
  const created = await createQrInvitation({}, 'owner', 'g1', f.env, f.transport);
  const invitePath = `groups/g1/invitations/${created.invitationId}`;
  const tokenPath = [...f.docs.keys()].find(path => path.startsWith('invitationTokens/'))!;
  const tokenDoc = f.docs.get(tokenPath)!;
  tokenDoc['invitationId'] = { stringValue: '../wrong' };
  await rejects(previewQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.code === 'invitation_unavailable');
  tokenDoc['invitationId'] = { stringValue: created.invitationId };
  f.docs.get(invitePath)!['expiresAt'] = { timestampValue: 'not-a-date' };
  await rejects(previewQrInvitation(created.token, 'guest', 'guest@example.com', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.code === 'invitation_expired');
  f.docs.get(invitePath)!['expiresAt'] = { timestampValue: created.expiresAt };
  f.docs.get(invitePath)!['tokenHash'] = { stringValue: 'bad-hash' };
  await rejects(revokeQrInvitation(created.invitationId, 'owner', 'g1', f.env, f.transport),
    (error: unknown) => error instanceof QrInvitationError && error.status === 503);
  strictEqual(f.docs.get(invitePath)?.status.stringValue, 'active');
});
