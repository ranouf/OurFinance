/** Resolves navigation only after Firebase has restored the initial session. */
export function authDestination(
  ready: boolean,
  path: string,
  user: { emailVerified: boolean } | null,
  hasPendingInvite: boolean,
): '/login' | '/join' | '/dashboard' | null {
  if (!ready) return null;
  if (path === '/ui/components') return null;
  if (hasPendingInvite && user?.emailVerified && path !== '/join') return '/join';
  if ((!user || !user.emailVerified) && path !== '/login' && path !== '/join') return '/login';
  if (user?.emailVerified && !hasPendingInvite && (path === '/login' || path === '/join')) return '/dashboard';
  return null;
}
