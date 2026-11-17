import { test } from 'node:test';
import { strictEqual, throws } from 'node:assert';
import { capturePendingInvite, clearPendingInvite, inviteUrl, readPendingInvite, validateInviteLink } from '../../src/app/core/firebase/pending-invite';

test('QR link contains only an opaque token in its fragment', () => {
  const token = 'a'.repeat(43);
  const url = new URL(inviteUrl('https://ourfinance-test.web.app', token));
  strictEqual(url.pathname, '/join');
  strictEqual(url.search, '');
  strictEqual(url.hash, `#invite=${token}`);
  strictEqual(validateInviteLink(url.toString(), url.origin), url.toString());
  throws(() => inviteUrl('http://example.test', token));
  throws(() => inviteUrl('https://example.test', `group.${token}`));
  throws(() => validateInviteLink(`https://evil.example/join#invite=${token}`, url.origin));
  throws(() => validateInviteLink(`https://ourfinance-test.web.app/join?next=evil#invite=${token}`, url.origin));
  throws(() => validateInviteLink(`${url.toString()}&extra=1`, url.origin));
});

test('landing captures and erases the fragment, preserving the invite for authentication', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const calls: string[] = [];
  const history = { state: null, replaceState: (_state: unknown, _title: string, url?: string | URL | null) => { calls.push(String(url)); } };
  const token = 'b'.repeat(43);
  strictEqual(capturePendingInvite({ hash: `#invite=${token}`, pathname: '/join', search: '' }, history, storage), token);
  strictEqual(calls[0], '/join');
  strictEqual(readPendingInvite(storage), token);
  clearPendingInvite(storage);
  strictEqual(readPendingInvite(storage), null);
  strictEqual(capturePendingInvite({ hash: '#invite=invalid', pathname: '/join', search: '' }, history, storage), null);
  strictEqual(calls.length, 2);
});
