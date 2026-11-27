const KEY = 'ourfinance.pendingInvite';
const INVALID_KEY = 'ourfinance.pendingInviteInvalid';
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function inviteUrl(origin: string, token: string): string {
  if (!tokenPattern.test(token)) throw new Error('Invalid invitation token');
  const url = new URL('/join', origin);
  if (url.protocol !== 'https:' || url.origin !== new URL(origin).origin) throw new Error('Invalid invitation origin');
  url.hash = new URLSearchParams({ invite: token }).toString();
  return url.toString();
}

export function validateInviteLink(link: string, origin: string): string {
  const url = new URL(link);
  const params = new URLSearchParams(url.hash.slice(1));
  const token = params.get('invite');
  if (url.protocol !== 'https:' || url.origin !== new URL(origin).origin || url.pathname !== '/join' || url.search || [...params].length !== 1 || !token || !tokenPattern.test(token)) throw new Error('Invalid invitation link');
  return url.toString();
}

export function readPendingInvite(storage: Pick<Storage, 'getItem' | 'removeItem'>): string | null {
  const token = storage.getItem(KEY);
  if (token && tokenPattern.test(token)) return token;
  if (token) storage.removeItem(KEY);
  return null;
}

export function readInvalidInvite(storage: Pick<Storage, 'getItem'>): boolean { return storage.getItem(INVALID_KEY) === '1'; }
export function clearPendingInvite(storage: Pick<Storage, 'removeItem'>): void { storage.removeItem(KEY); storage.removeItem(INVALID_KEY); }

/** Capture before auth redirects; never put the token in a reset continueUrl. */
export function capturePendingInvite(location: Pick<Location, 'hash' | 'pathname' | 'search'>, history: Pick<History, 'replaceState' | 'state'>, storage: Pick<Storage, 'setItem' | 'getItem' | 'removeItem'>): string | null {
  const fragment = location.hash;
  if (fragment.startsWith('#invite=')) {
    const params = new URLSearchParams(fragment.slice(1));
    const token = [...params].length === 1 ? params.get('invite') : null;
    history.replaceState(history.state, '', location.pathname + location.search);
    if (token && tokenPattern.test(token)) storage.setItem(KEY, token);
    else storage.removeItem(KEY);
  }
  return readPendingInvite(storage);
}
