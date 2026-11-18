import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import type { User } from 'firebase/auth';
import { InvitationService } from '../../src/app/core/firebase/invitation-service';
import { QrInvitationService, QrInviteRequestError } from '../../src/app/core/firebase/qr-invitation-service';

const token = 'x'.repeat(43);
const user = { emailVerified: true, getIdToken: async () => 'fixture-token' } as User;
type Call = { url: string; method: string; authorization: string | null; body: unknown };

function transport(reply: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('Authorization'),
      body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined };
    calls.push(call);
    return reply(call);
  };
  return { calls, fetcher: fetcher as typeof fetch };
}

test('legacy invitation create trims target and accept submits opaque token only to scoped Worker', async () => {
  const t = transport(call => call.url.endsWith('/accept') ? new Response(null, { status: 204 }) :
    Response.json({ invitationId: 'invite-1', token }));
  const service = new InvitationService('https://worker.example', t.fetcher);
  const code = await service.create(user, 'group-a', '  friend@example.test  ');
  strictEqual(code, `group-a.invite-1.${token}`);
  await service.accept(user, code);
  deepStrictEqual(t.calls, [
    { url: 'https://worker.example/groups/group-a/invitations', method: 'POST', authorization: 'Bearer fixture-token',
      body: { targetEmail: 'friend@example.test' } },
    { url: 'https://worker.example/groups/group-a/invitations/invite-1/accept', method: 'POST',
      authorization: 'Bearer fixture-token', body: { token } },
  ]);
});

test('legacy invitation refuses invalid code, unverified identity, insecure URL and denied response', async () => {
  const t = transport(() => new Response(null, { status: 403 }));
  const service = new InvitationService('https://worker.example', t.fetcher);
  await rejects(service.accept(user, 'bad'), /Code invalide/);
  await rejects(service.create({ ...user, emailVerified: false } as User, 'g', ''), /courriel/);
  strictEqual(t.calls.length, 0);
  await rejects(service.create(user, 'g', ''), /HTTP 403/);
  const insecure = new InvitationService('http://worker.example', t.fetcher);
  await rejects(insecure.create(user, 'g', ''), /sécurisée/);
});

test('QR service covers creation, listing, preview, explicit accept and owner revoke', async () => {
  const link = `https://app.example/join#invite=${token}`;
  const t = transport(call => {
    if (call.url.endsWith('/qr-invitations') && call.method === 'POST') return Response.json({ invitationId: 'invite-1', link, expiresAt: 'later' });
    if (call.url.includes('pageToken=')) return Response.json({ invitations: [{ invitationId: 'invite-1', status: 'active', expiresAt: 'later', targetEmail: null }], nextPageToken: null });
    if (call.url.endsWith('/preview')) return Response.json({ groupName: 'Fixture', currency: 'CAD', expiresAt: 'later' });
    if (call.url.endsWith('/accept')) return Response.json({ groupId: 'group-a' });
    return new Response(null, { status: 204 });
  });
  const service = new QrInvitationService('https://worker.example', t.fetcher, () => 'https://app.example');
  deepStrictEqual(await service.create(user, 'group-a', 'friend@example.test'), { invitationId: 'invite-1', link, expiresAt: 'later' });
  strictEqual((await service.list(user, 'group-a', 'next page')).invitations.length, 1);
  strictEqual((await service.preview(user, token)).currency, 'CAD');
  deepStrictEqual(await service.accept(user, token), { groupId: 'group-a' });
  await service.revoke(user, 'group-a', 'invite-1');
  deepStrictEqual(t.calls.map(call => [call.method, call.url, call.authorization]), [
    ['POST', 'https://worker.example/groups/group-a/qr-invitations', 'Bearer fixture-token'],
    ['GET', 'https://worker.example/groups/group-a/qr-invitations?pageToken=next%20page', 'Bearer fixture-token'],
    ['POST', 'https://worker.example/qr-invitations/preview', 'Bearer fixture-token'],
    ['POST', 'https://worker.example/qr-invitations/accept', 'Bearer fixture-token'],
    ['POST', 'https://worker.example/groups/group-a/qr-invitations/invite-1/revoke', 'Bearer fixture-token'],
  ]);
  deepStrictEqual(t.calls[3].body, { token });
});

test('QR service refuses unverified identity and untrusted link, preserving server error code', async () => {
  const t = transport(() => Response.json({ error: 'invitation_used' }, { status: 409 }));
  const service = new QrInvitationService('https://worker.example', t.fetcher, () => 'https://app.example');
  await rejects(service.preview({ ...user, emailVerified: false } as User, token),
    (error: unknown) => error instanceof QrInviteRequestError && error.code === 'email_unverified');
  strictEqual(t.calls.length, 0);
  await rejects(service.accept(user, token),
    (error: unknown) => error instanceof QrInviteRequestError && error.status === 409 && error.code === 'invitation_used');
  const hostile = new QrInvitationService('https://worker.example', transport(() => Response.json({
    invitationId: 'x', link: `https://other.example/join#invite=${token}`, expiresAt: 'later',
  })).fetcher, () => 'https://app.example');
  await rejects(hostile.create(user, 'group-a'), /Invalid invitation link/);
});

test('QR service keeps empty creation and list explicit, and hides a malformed server error', async () => {
  const link = `https://app.example/join#invite=${token}`;
  const t = transport(call => {
    if (call.url.endsWith('/qr-invitations') && call.method === 'POST') return Response.json({ invitationId: 'i', link, expiresAt: 'later' });
    if (call.method === 'GET') return Response.json({ invitations: [], nextPageToken: null });
    return new Response('not json', { status: 503 });
  });
  const service = new QrInvitationService('https://worker.example', t.fetcher, () => 'https://app.example');
  await service.create(user, 'group-a');
  deepStrictEqual(t.calls[0].body, {});
  deepStrictEqual(await service.list(user, 'group-a'), { invitations: [], nextPageToken: null });
  await rejects(service.preview(user, token),
    (error: unknown) => error instanceof QrInviteRequestError && error.status === 503 && error.code === 'invitation_unavailable');
  const insecure = new QrInvitationService('http://worker.example', t.fetcher, () => 'https://app.example');
  await rejects(insecure.list(user, 'group-a'), /HTTPS/);
});
