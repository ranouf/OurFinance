/* Capture invitation fragments before Angular and other application code run. */
(() => {
  const key = 'ourfinance.pendingInvite';
  const invalidKey = 'ourfinance.pendingInviteInvalid';
  const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
  const capture = () => {
    if (location.pathname !== '/join' || !location.hash) return;
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.size === 1 ? params.get('invite') : null;
    history.replaceState(history.state, '', location.pathname + location.search);
    try {
      if (token && tokenPattern.test(token)) {
        sessionStorage.setItem(key, token);
        sessionStorage.removeItem(invalidKey);
      } else {
        sessionStorage.removeItem(key);
        sessionStorage.setItem(invalidKey, '1');
      }
    } catch { /* The Angular page will show an invitation unavailable state. */ }
    dispatchEvent(new Event('ourfinance:invite-changed'));
  };
  capture();
  addEventListener('hashchange', capture);
})();
