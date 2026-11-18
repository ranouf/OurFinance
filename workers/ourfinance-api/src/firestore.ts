import { isProviderQuotaStatus, ProviderQuotaError } from './provider-quota';

export interface MemberAccess {
  readonly role: 'owner' | 'member';
  readonly status: 'active' | 'revoked';
}

/** Firestore REST evaluates Security Rules using the caller's Firebase ID token. */
export async function readMember(projectId: string, groupId: string, uid: string, idToken: string, transport: typeof fetch = fetch): Promise<MemberAccess | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(uid)}`;
  const response = await transport(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (response.status === 403 || response.status === 404) return null;
  if (isProviderQuotaStatus(response.status)) throw new ProviderQuotaError();
  if (!response.ok) throw new Error(`Firestore indisponible (${response.status})`);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('fields' in body)) throw new Error('Réponse Firestore invalide');
  const fields = (body as { fields: Record<string, { stringValue?: string }> }).fields;
  const role = fields['role']?.stringValue;
  const status = fields['status']?.stringValue;
  if ((role !== 'owner' && role !== 'member') || (status !== 'active' && status !== 'revoked')) throw new Error('Membre invalide');
  return { role, status };
}
