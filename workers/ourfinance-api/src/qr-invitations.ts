import { serviceAccessToken } from './service-account';

export interface QrInvitationEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; readonly QR_INVITATION_POC_GROUP_ID: string; }
export class QrInvitationError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const string = (stringValue: string) => ({ stringValue });
const value = (doc: Record<string, unknown> | null, key: string): string | undefined => {
  const fields = doc?.['fields'] as Record<string, { stringValue?: string; timestampValue?: string }> | undefined;
  return fields?.[key]?.stringValue ?? fields?.[key]?.timestampValue;
};

async function digest(token: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function emailTarget(input: unknown): string | undefined {
  if (input === undefined || input === null || input === '') return undefined;
  if (typeof input !== 'string') throw new QrInvitationError(400, 'invalid_email');
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new QrInvitationError(400, 'invalid_email');
  return email;
}

async function store(env: QrInvitationEnv, transport: typeof fetch) {
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const access = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' };
  const read = async (path: string, transaction?: string): Promise<Record<string, unknown> | null> => {
    const query = transaction ? `?transaction=${encodeURIComponent(transaction)}` : '';
    const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}${query}`, { headers });
    if (response.status === 404) return null;
    if (!response.ok) throw new QrInvitationError(503, 'firestore_unavailable');
    return await response.json() as Record<string, unknown>;
  };
  const begin = async (): Promise<string> => {
    const response = await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' });
    if (!response.ok) throw new QrInvitationError(503, 'transaction_unavailable');
    const body = await response.json() as { transaction?: string };
    if (!body.transaction) throw new QrInvitationError(503, 'transaction_unavailable');
    return body.transaction;
  };
  const commit = async (transaction: string, writes: unknown[]) => {
    const response = await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) });
    if (!response.ok) throw new QrInvitationError(response.status === 409 ? 409 : 503, response.status === 409 ? 'conflict' : 'firestore_unavailable');
  };
  const rollback = async (transaction: string) => {
    await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) });
  };
  return { root, allowedGroupId: env.QR_INVITATION_POC_GROUP_ID, read, begin, commit, rollback };
}

async function withTransaction<T>(db: Awaited<ReturnType<typeof store>>, action: (transaction: string) => Promise<T>): Promise<T> {
  const transaction = await db.begin();
  try { return await action(transaction); }
  catch (error) { await db.rollback(transaction).catch(() => undefined); throw error; }
}

function ensureToken(token: unknown): asserts token is string {
  if (typeof token !== 'string' || !tokenPattern.test(token)) throw new QrInvitationError(400, 'invalid_invitation');
}

async function resolvedInvitation(db: Awaited<ReturnType<typeof store>>, token: string, transaction?: string) {
  const hash = await digest(token);
  const lookup = await db.read(`invitationTokens/${hash}`, transaction);
  const groupId = value(lookup, 'groupId');
  const invitationId = value(lookup, 'invitationId');
  if (!groupId || !invitationId || !idPattern.test(groupId) || !idPattern.test(invitationId)) throw new QrInvitationError(403, 'invitation_unavailable');
  if (groupId !== db.allowedGroupId) throw new QrInvitationError(403, 'invitation_unavailable');
  const group = await db.read(`groups/${groupId}`, transaction);
  const invitation = await db.read(`groups/${groupId}/invitations/${invitationId}`, transaction);
  if (value(group, 'status') !== 'active' || value(invitation, 'status') !== 'active' || value(invitation, 'tokenHash') !== hash) throw new QrInvitationError(403, 'invitation_unavailable');
  const expiresAt = value(invitation, 'expiresAt');
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) throw new QrInvitationError(403, 'invitation_expired');
  return { groupId, invitationId, group, invitation, hash, expiresAt };
}

/** The URL contains only a random 256-bit token; the group lookup is server-only. */
export async function createQrInvitation(input: unknown, uid: string, groupId: string, env: QrInvitationEnv, transport: typeof fetch = fetch) {
  if (!idPattern.test(uid) || !idPattern.test(groupId) || !input || typeof input !== 'object') throw new QrInvitationError(400, 'invalid_invitation');
  if (groupId !== env.QR_INVITATION_POC_GROUP_ID) throw new QrInvitationError(403, 'invitation_unavailable');
  const target = emailTarget((input as Record<string, unknown>)['targetEmail']);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const hash = await digest(token);
  const invitationId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const db = await store(env, transport);
  return withTransaction(db, async transaction => {
    const group = await db.read(`groups/${groupId}`, transaction);
    const owner = await db.read(`groups/${groupId}/members/${uid}`, transaction);
    if (value(group, 'status') !== 'active' || value(owner, 'status') !== 'active' || value(owner, 'role') !== 'owner') throw new QrInvitationError(403, 'owner_required');
    const fields: Record<string, unknown> = {
      tokenHash: string(hash), status: string('active'), createdBy: string(uid), createdAt: { timestampValue: now.toISOString() },
      expiresAt: { timestampValue: expiresAt }, maxUses: { integerValue: '1' },
    };
    if (target) fields['targetEmail'] = string(target);
    await db.commit(transaction, [
      { update: { name: `${db.root}/groups/${groupId}/invitations/${invitationId}`, fields }, currentDocument: { exists: false } },
      { update: { name: `${db.root}/invitationTokens/${hash}`, fields: { groupId: string(groupId), invitationId: string(invitationId), expiresAt: { timestampValue: expiresAt } } }, currentDocument: { exists: false } },
    ]);
    return { token, invitationId, expiresAt };
  });
}

export async function previewQrInvitation(token: unknown, uid: string, email: string, env: QrInvitationEnv, transport: typeof fetch = fetch) {
  ensureToken(token);
  const db = await store(env, transport);
  const { groupId, group, invitation, expiresAt } = await resolvedInvitation(db, token);
  const target = value(invitation, 'targetEmail');
  if (target && target !== email.toLowerCase()) throw new QrInvitationError(403, 'invitation_unavailable');
  const member = await db.read(`groups/${groupId}/members/${uid}`);
  if (member) throw new QrInvitationError(value(member, 'status') === 'revoked' ? 403 : 409, 'already_member');
  return { groupName: value(group, 'name') ?? '', currency: value(group, 'currency') ?? value(group, 'currencyCode') ?? '', expiresAt };
}

export async function acceptQrInvitation(token: unknown, uid: string, email: string, env: QrInvitationEnv, transport: typeof fetch = fetch): Promise<string> {
  ensureToken(token);
  const db = await store(env, transport);
  return withTransaction(db, async transaction => {
    const { groupId, invitationId, invitation, hash } = await resolvedInvitation(db, token, transaction);
    const target = value(invitation, 'targetEmail');
    if (target && target !== email.toLowerCase()) throw new QrInvitationError(403, 'invitation_unavailable');
    const member = await db.read(`groups/${groupId}/members/${uid}`, transaction);
    if (member) throw new QrInvitationError(value(member, 'status') === 'revoked' ? 403 : 409, 'already_member');
    const now = new Date().toISOString();
    await db.commit(transaction, [
      { update: { name: `${db.root}/groups/${groupId}/invitations/${invitationId}`, fields: { status: string('accepted'), acceptedBy: string(uid), acceptedAt: { timestampValue: now } } }, updateMask: { fieldPaths: ['status', 'acceptedBy', 'acceptedAt'] } },
      { update: { name: `${db.root}/groups/${groupId}/members/${uid}`, fields: { role: string('member'), status: string('active'), joinedAt: { timestampValue: now } } }, currentDocument: { exists: false } },
      { update: { name: `${db.root}/users/${uid}/groupMemberships/${groupId}`, fields: { groupId: string(groupId), role: string('member'), status: string('active') } }, currentDocument: { exists: false } },
      { delete: `${db.root}/invitationTokens/${hash}` },
    ]);
    return groupId;
  });
}

export async function revokeQrInvitation(invitationId: string, uid: string, groupId: string, env: QrInvitationEnv, transport: typeof fetch = fetch): Promise<void> {
  if (![invitationId, uid, groupId].every(id => idPattern.test(id))) throw new QrInvitationError(400, 'invalid_invitation');
  if (groupId !== env.QR_INVITATION_POC_GROUP_ID) throw new QrInvitationError(403, 'invitation_unavailable');
  const db = await store(env, transport);
  await withTransaction(db, async transaction => {
    const group = await db.read(`groups/${groupId}`, transaction);
    const owner = await db.read(`groups/${groupId}/members/${uid}`, transaction);
    const invitation = await db.read(`groups/${groupId}/invitations/${invitationId}`, transaction);
    if (value(group, 'status') !== 'active' || value(owner, 'status') !== 'active' || value(owner, 'role') !== 'owner') throw new QrInvitationError(403, 'owner_required');
    if (value(invitation, 'status') !== 'active') throw new QrInvitationError(409, 'invitation_unavailable');
    const hash = value(invitation, 'tokenHash');
    if (!hash || !/^[a-f0-9]{64}$/.test(hash)) throw new QrInvitationError(503, 'invitation_unavailable');
    await db.commit(transaction, [
      { update: { name: `${db.root}/groups/${groupId}/invitations/${invitationId}`, fields: { status: string('revoked'), revokedAt: { timestampValue: new Date().toISOString() } } }, updateMask: { fieldPaths: ['status', 'revokedAt'] } },
      { delete: `${db.root}/invitationTokens/${hash}` },
    ]);
  });
}
