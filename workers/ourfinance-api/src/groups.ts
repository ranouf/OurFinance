import { serviceAccessToken } from './service-account';

export interface NewGroup { readonly name: string; readonly currency: string; }
export interface GroupEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }

export function validateNewGroup(value: unknown): NewGroup {
  if (!value || typeof value !== 'object') throw new Error('Groupe invalide');
  const input = value as Record<string, unknown>;
  if (typeof input['name'] !== 'string' || input['name'].trim().length < 1 || input['name'].trim().length > 80 ||
      typeof input['currency'] !== 'string' || !/^[A-Z]{3}$/.test(input['currency']) ||
      !Intl.supportedValuesOf('currency').includes(input['currency'])) throw new Error('Groupe invalide');
  return { name: input['name'].trim(), currency: input['currency'] };
}

/** Atomic server-owned group, owner member and personal group reference. */
export async function createGroup(value: unknown, uid: string, env: GroupEnv, transport: typeof fetch = fetch): Promise<string> {
  const group = validateNewGroup(value);
  const groupId = crypto.randomUUID();
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const now = new Date().toISOString();
  const update = (path: string, fields: Record<string, unknown>) => ({ update: { name: `${root}/${path}`, fields }, currentDocument: { exists: false } });
  const string = (stringValue: string) => ({ stringValue });
  const writes = [
    update(`groups/${groupId}`, { name: string(group.name), currency: string(group.currency), currencyCode: string(group.currency), ownerId: string(uid), status: string('active'), createdAt: { timestampValue: now } }),
    update(`groups/${groupId}/members/${uid}`, { role: string('owner'), status: string('active'), joinedAt: { timestampValue: now } }),
    update(`users/${uid}/groupMemberships/${groupId}`, { groupId: string(groupId), role: string('owner'), status: string('active') }),
  ];
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const response = await transport(`https://firestore.googleapis.com/v1/${root}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (!response.ok) throw new Error(`Création de groupe refusée (${response.status})`);
  return groupId;
}
