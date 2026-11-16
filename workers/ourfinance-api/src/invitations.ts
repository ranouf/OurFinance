import { serviceAccessToken } from './service-account';

export interface InvitationEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export class InvitationError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const string = (stringValue: string) => ({ stringValue });
const field = (document: Record<string, unknown> | null, key: string): string | undefined => {
  const fields = document?.['fields'] as Record<string, { stringValue?: string; timestampValue?: string }> | undefined;
  return fields?.[key]?.stringValue ?? fields?.[key]?.timestampValue;
};

function targetEmail(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new InvitationError(400, 'invalid_email');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new InvitationError(400, 'invalid_email');
  return email;
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function sameHash(a: string, b: string): boolean {
  if (a.length !== 64 || b.length !== 64) return false;
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new InvitationError(response.status === 409 ? 409 : 503, response.status === 409 ? 'conflict' : 'firestore_unavailable');
  return await response.json() as Record<string, unknown>;
}
async function transaction(env: InvitationEnv, transport: typeof fetch) {
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const accessToken = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new InvitationError(503, 'transaction_unavailable');
  const transactionId = begin['transaction'];
  const read = async (path: string): Promise<Record<string, unknown> | null> => {
    const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transactionId)}`, { headers });
    if (response.status === 404) return null;
    return await checked(response);
  };
  const commit = async (writes: unknown[]) => {
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction: transactionId, writes }) }));
  };
  return { root, read, commit };
}

/** Creates a 256-bit single-use token. Only its SHA-256 digest is stored in Firestore. */
export async function createInvitation(value: unknown, uid: string, groupId: string, env: InvitationEnv, transport: typeof fetch = fetch): Promise<{ invitationId: string; token: string; expiresAt: string }> {
  if (!idPattern.test(uid) || !idPattern.test(groupId) || !value || typeof value !== 'object') throw new InvitationError(400, 'invalid_invitation');
  const email = targetEmail((value as Record<string, unknown>)['targetEmail']);
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const { root, read, commit } = await transaction(env, transport);
  const group = await read(`groups/${groupId}`);
  const owner = await read(`groups/${groupId}/members/${uid}`);
  if (field(group, 'status') !== 'active' || field(owner, 'status') !== 'active' || field(owner, 'role') !== 'owner') throw new InvitationError(403, 'owner_required');
  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    tokenHash: string(await hashToken(token)), status: string('active'), createdBy: string(uid), createdAt: { timestampValue: now }, expiresAt: { timestampValue: expiresAt },
  };
  if (email) fields['targetEmail'] = string(email);
  await commit([{ update: { name: `${root}/groups/${groupId}/invitations/${invitationId}`, fields }, currentDocument: { exists: false } }]);
  return { invitationId, token, expiresAt };
}

/** Transactional redemption rejects expiry, target mismatch, replay and revoked accounts. */
export async function acceptInvitation(token: unknown, invitationId: string, uid: string, email: string, groupId: string, env: InvitationEnv, transport: typeof fetch = fetch): Promise<void> {
  if (typeof token !== 'string' || !tokenPattern.test(token) || ![invitationId, uid, groupId].every(id => idPattern.test(id))) throw new InvitationError(400, 'invalid_invitation');
  const { root, read, commit } = await transaction(env, transport);
  const group = await read(`groups/${groupId}`);
  const invite = await read(`groups/${groupId}/invitations/${invitationId}`);
  if (field(group, 'status') !== 'active' || !invite || field(invite, 'status') !== 'active' || !sameHash(field(invite, 'tokenHash') ?? '', await hashToken(token))) throw new InvitationError(403, 'invitation_unavailable');
  const expiresAt = field(invite, 'expiresAt');
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) throw new InvitationError(403, 'invitation_expired');
  const target = field(invite, 'targetEmail');
  if (target && target !== email.toLowerCase()) throw new InvitationError(403, 'email_mismatch');
  const member = await read(`groups/${groupId}/members/${uid}`);
  if (member) throw new InvitationError(field(member, 'status') === 'revoked' ? 403 : 409, 'already_member');
  const now = new Date().toISOString();
  await commit([
    { update: { name: `${root}/groups/${groupId}/invitations/${invitationId}`, fields: { status: string('accepted'), acceptedBy: string(uid), acceptedAt: { timestampValue: now } } }, updateMask: { fieldPaths: ['status', 'acceptedBy', 'acceptedAt'] } },
    { update: { name: `${root}/groups/${groupId}/members/${uid}`, fields: { role: string('member'), status: string('active'), joinedAt: { timestampValue: now } } }, currentDocument: { exists: false } },
    { update: { name: `${root}/users/${uid}/groupMemberships/${groupId}`, fields: { groupId: string(groupId), role: string('member'), status: string('active') } }, currentDocument: { exists: false } },
  ]);
}
