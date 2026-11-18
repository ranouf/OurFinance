import type { User } from 'firebase/auth';

export interface SharedMemberProfile { readonly userId: string; readonly displayName?: string; }

/** The Worker exposes only names of active peers to an active group member. */
export async function loadSharedMemberProfiles(workerUrl: string, groupId: string, user: User): Promise<SharedMemberProfile[]> {
  if (!user.emailVerified || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId)) return [];
  const url = new URL(`/groups/${encodeURIComponent(groupId)}/member-profiles`, workerUrl);
  if (url.protocol !== 'https:') return [];
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
  if (!response.ok) return [];
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('members' in body) || !Array.isArray(body.members)) return [];
  return body.members.filter((item): item is SharedMemberProfile =>
    !!item && typeof item === 'object' && typeof item.userId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(item.userId) &&
    (item.displayName === undefined || (typeof item.displayName === 'string' && item.displayName.length <= 80)));
}
