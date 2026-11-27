import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { evaluateQuotaSnapshot, limits } from '../../tools/quota-monitor/check.mjs';

test('chaque quota Free distingue marge, avertissement et intervention', () => {
  const snapshot = Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key, limit.max * 0.5]));
  snapshot.recordedAt = '2026-11-27T12:00:00Z';
  snapshot.firestoreReads = 35_000;
  snapshot.cloudflareAccountRequests = 90_000;
  snapshot.cloudinaryCredits = 22.5;
  const states = Object.fromEntries(evaluateQuotaSnapshot(snapshot).map(row => [row.key, row.state]));
  strictEqual(states.firestoreReads, 'warning');
  strictEqual(states.cloudflareAccountRequests, 'intervention');
  strictEqual(states.cloudinaryCredits, 'intervention');
  strictEqual(states.firestoreWrites, 'ok');
});

test('une mesure absente reste explicitement incomplète', () => {
  const result = evaluateQuotaSnapshot({ recordedAt: '2026-11-27T12:00:00Z', firestoreReads: 1 });
  deepStrictEqual(result.filter(row => row.state === 'missing').map(row => row.key),
    Object.keys(limits).filter(key => key !== 'firestoreReads'));
});

test('refuse les données négatives, inconnues ou sans période UTC', () => {
  throws(() => evaluateQuotaSnapshot({ recordedAt: '2026-11-27T12:00:00Z', firestoreReads: -1 }));
  throws(() => evaluateQuotaSnapshot({ recordedAt: '2026-11-27T12:00:00Z', token: 'secret' }));
  throws(() => evaluateQuotaSnapshot({ recordedAt: '2026-11-27', firestoreReads: 1 }));
});
