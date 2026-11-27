import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../public/invite-capture.js', import.meta.url), 'utf8');

test('the preboot script erases the fragment before notifying the application', () => {
  const key = 'ourfinance.pendingInvite';
  const values = new Map<string, string>();
  const token = 'a'.repeat(43);
  const location = { pathname: '/join', search: '', hash: `#invite=${token}` };
  const handlers = new Map<string, () => void>();
  const observations: string[] = [];
  const context = {
    location,
    URLSearchParams,
    Event: class { constructor(readonly type: string) {} },
    history: { state: null, replaceState: (_state: unknown, _title: string, url: string) => { observations.push(`replace:${url}`); location.hash = ''; } },
    sessionStorage: { setItem: (name: string, value: string) => values.set(name, value), removeItem: (name: string) => values.delete(name) },
    addEventListener: (name: string, handler: () => void) => handlers.set(name, handler),
    dispatchEvent: (event: { type: string }) => { observations.push(`${event.type}:${location.hash}:${values.get(key)}`); },
  };
  runInNewContext(source, context);
  strictEqual(values.get(key), token);
  strictEqual(observations[0], 'replace:/join');
  strictEqual(observations[1], `ourfinance:invite-changed::${token}`);

  location.hash = '#invite=bad';
  handlers.get('hashchange')?.();
  strictEqual(values.has(key), false);
  strictEqual(values.get('ourfinance.pendingInviteInvalid'), '1');
  strictEqual(observations.at(-1), 'ourfinance:invite-changed::undefined');
});
