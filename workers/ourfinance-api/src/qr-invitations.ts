import { readDocumentInTransaction } from './firestore-transaction-read';
import { unavailableCode } from './provider-quota';
import { serviceAccessToken } from './service-account';

export interface QrInvitationEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; readonly QR_INVITATION_POC_GROUP_ID?: string; }
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
const expired = (at: string): boolean => !Number.isFinite(Date.parse(at)) || Date.parse(at) <= Date.now();

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
    const response = transaction
      ? await readDocumentInTransaction(root, path, transaction, headers, transport)
      : await transport(`https://firestore.googleapis.com/v1/${root}/${path}`, { headers });
    if (response.status === 404) return null;
    if (!response.ok) throw new QrInvitationError(503, unavailableCode(response, 'firestore_unavailable'));
    return await response.json() as Record<string, unknown>;
  };
  const begin = async (): Promise<string> => {
    const response = await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' });
    if (!response.ok) throw new QrInvitationError(503, unavailableCode(response, 'transaction_unavailable'));
    const body = await response.json() as { transaction?: string };
    if (!body.transaction) throw new QrInvitationError(503, 'transaction_unavailable');
    return body.transaction;
  };
  const commit = async (transaction: string, writes: unknown[]) => {
    const response = await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) });
    if (!response.ok) throw new QrInvitationError(response.status === 409 ? 409 : 503, response.status === 409 ? 'conflict' : unavailableCode(response, 'firestore_unavailable'));
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
  if (db.allowedGroupId && groupId !== db.allowedGroupId) throw new QrInvitationError(403, 'invitation_unavailable');
  const group = await db.read(`groups/${groupId}`, transaction);
  const invitation = await db.read(`groups/${groupId}/invitations/${invitationId}`, transaction);
  if (value(group, 'status') !== 'active' || value(invitation, 'status') !== 'active' || value(invitation, 'tokenHash') !== hash) throw new QrInvitationError(403, 'invitation_unavailable');
  const expiresAt = value(invitation, 'expiresAt');
  if (!expiresAt || expired(expiresAt)) throw new QrInvitationError(403, 'invitation_expired');
  return { groupId, invitationId, group, invitation, hash, expiresAt };
}

/** The URL contains only a random 256-bit token; the group lookup is server-only. */
export async function createQrInvitation(input: unknown, uid: string, groupId: string, env: QrInvitationEnv, transport: typeof fetch = fetch) {
  if (!idPattern.test(uid) || !idPattern.test(groupId) || !input || typeof input !== 'object') throw new QrInvitationError(400, 'invalid_invitation');
  if (env.QR_INVITATION_POC_GROUP_ID && groupId !== env.QR_INVITATION_POC_GROUP_ID) throw new QrInvitationError(403, 'invitation_unavailable');
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
  if (target && target !== email.toLowerCase()) throw new QrInvitationError(403, 'email_mismatch');
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
    if (target && target !== email.toLowerCase()) throw new QrInvitationError(403, 'email_mismatch');
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
  if (env.QR_INVITATION_POC_GROUP_ID && groupId !== env.QR_INVITATION_POC_GROUP_ID) throw new QrInvitationError(403, 'invitation_unavailable');
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

export async function listQrInvitations(groupId: string, uid: string, env: QrInvitationEnv, pageToken = '', transport: typeof fetch = fetch) {
  if (![groupId, uid].every(id => idPattern.test(id)) || pageToken.length > 1024) throw new QrInvitationError(400, 'invalid_invitation');
  if (env.QR_INVITATION_POC_GROUP_ID && groupId !== env.QR_INVITATION_POC_GROUP_ID) throw new QrInvitationError(403, 'invitation_unavailable');
  const db = await store(env, transport);
  const group = await db.read(`groups/${groupId}`);
  const owner = await db.read(`groups/${groupId}/members/${uid}`);
  if (value(group, 'status') !== 'active' || value(owner, 'status') !== 'active' || value(owner, 'role') !== 'owner') throw new QrInvitationError(403, 'owner_required');
  const access = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const url = new URL(`https://firestore.googleapis.com/v1/${db.root}/groups/${groupId}/invitations`);
  url.searchParams.set('pageSize', '20');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await transport(url.toString(), { headers: { Authorization: `Bearer ${access}` } });
  if (!response.ok) throw new QrInvitationError(503, unavailableCode(response, 'firestore_unavailable'));
  const body = await response.json() as { documents?: Array<Record<string, unknown>>; nextPageToken?: string };
  // Owner-listing provides bounded, opportunistic cleanup without a scheduled
  // service. A transaction rechecks ownership and expiry before removing the
  // server-only token lookup, so an acceptance or revocation cannot be undone.
  for (const doc of body.documents ?? []) {
    const prefix = `${db.root}/groups/${groupId}/invitations/`;
    const name = doc['name'];
    const invitationId = typeof name === 'string' && name.startsWith(prefix) ? name.slice(prefix.length) : '';
    const expiresAt = value(doc, 'expiresAt');
    if (!idPattern.test(invitationId) || value(doc, 'status') !== 'active' || !expiresAt || !expired(expiresAt)) continue;
    try { await withTransaction(db, async transaction => {
      const currentGroup = await db.read(`groups/${groupId}`, transaction);
      const currentOwner = await db.read(`groups/${groupId}/members/${uid}`, transaction);
      const current = await db.read(`groups/${groupId}/invitations/${invitationId}`, transaction);
      if (value(currentGroup, 'status') !== 'active' || value(currentOwner, 'status') !== 'active' || value(currentOwner, 'role') !== 'owner') {
        throw new QrInvitationError(403, 'owner_required');
      }
      const hash = value(current, 'tokenHash');
      const currentExpiry = value(current, 'expiresAt');
      if (value(current, 'status') !== 'active' || !currentExpiry || !expired(currentExpiry) || !hash || !/^[a-f0-9]{64}$/.test(hash)) {
        throw new QrInvitationError(409, 'conflict');
      }
      const lookup = await db.read(`invitationTokens/${hash}`, transaction);
      const writes: unknown[] = [{ update: { name: `${db.root}/groups/${groupId}/invitations/${invitationId}`,
        fields: { status: string('expired') } }, updateMask: { fieldPaths: ['status'] } }];
      if (value(lookup, 'groupId') === groupId && value(lookup, 'invitationId') === invitationId) {
        writes.push({ delete: `${db.root}/invitationTokens/${hash}` });
      }
      await db.commit(transaction, writes);
    }); }
    catch (error) {
      // Expiry is enforced on preview and acceptance even when maintenance
      // fails; keep the owner's read available and retry on the next listing.
      if (error instanceof QrInvitationError && error.status === 403) throw error;
    }
  }
  return {
    invitations: (body.documents ?? []).map(doc => {
      const expiresAt = value(doc, 'expiresAt') ?? '';
      const status = value(doc, 'status') ?? 'unknown';
      return {
        invitationId: String(doc['name']).split('/').pop() ?? '',
        status: status === 'active' && expired(expiresAt) ? 'expired' : status,
        expiresAt,
        targetEmail: value(doc, 'targetEmail') ?? null,
      };
    }),
    nextPageToken: body.nextPageToken ?? null,
  };
}
