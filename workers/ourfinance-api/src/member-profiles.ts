import { readMember } from './firestore';
import { serviceAccessToken } from './service-account';

export interface MemberProfileEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export interface SharedMemberProfile { readonly userId: string; readonly displayName?: string; }
export class MemberProfileError extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }

interface FirestoreDoc { readonly name?: string; readonly fields?: Record<string, { stringValue?: string }>; }

/** Only group members can see an active peer's explicitly supplied display name. */
export async function listSharedMemberProfiles(groupId: string, callerUid: string, idToken: string, env: MemberProfileEnv, transport: typeof fetch = fetch): Promise<SharedMemberProfile[]> {
  const access = await readMember(env.FIREBASE_PROJECT_ID, groupId, callerUid, idToken, transport);
  if (!access || access.status !== 'active') throw new MemberProfileError(403, 'member_inactive');
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
  const members: string[] = [];
  let pageToken = '';
  do {
    const url = new URL(`${root}/groups/${encodeURIComponent(groupId)}/members`);
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await transport(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new MemberProfileError(503, 'members_unavailable');
    const body = await response.json() as { documents?: FirestoreDoc[]; nextPageToken?: string };
    for (const member of body.documents ?? []) {
      if (member.fields?.['status']?.stringValue !== 'active') continue;
      const userId = member.name?.split('/').at(-1);
      if (!userId || !/^[A-Za-z0-9_-]{1,128}$/.test(userId)) throw new MemberProfileError(503, 'member_invalid');
      members.push(userId);
    }
    if (members.length > 100) throw new MemberProfileError(413, 'group_too_large');
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  const profiles = await Promise.all(members.map(async userId => {
    const response = await transport(`${root}/users/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404) return { userId };
    if (!response.ok) throw new MemberProfileError(503, 'profile_unavailable');
    const data = await response.json() as FirestoreDoc;
    const name = data.fields?.['displayName']?.stringValue?.trim();
    return name && name.length <= 80 ? { userId, displayName: name } : { userId };
  }));
  const stillActive = await readMember(env.FIREBASE_PROJECT_ID, groupId, callerUid, idToken, transport);
  if (!stillActive || stillActive.status !== 'active') throw new MemberProfileError(403, 'member_inactive');
  return profiles;
}
