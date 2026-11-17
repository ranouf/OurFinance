import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { isProviderQuotaStatus, unavailableCode } from '../src/provider-quota';

test('quota status maps to a fixed code without parsing provider bodies', () => {
  strictEqual(isProviderQuotaStatus(420), true);
  strictEqual(isProviderQuotaStatus(429), true);
  strictEqual(isProviderQuotaStatus(503), false);
  strictEqual(unavailableCode(new Response('private detail', { status: 429 }), 'firestore_unavailable'), 'provider_quota_exceeded');
  strictEqual(unavailableCode(new Response('private detail', { status: 503 }), 'firestore_unavailable'), 'firestore_unavailable');
});
