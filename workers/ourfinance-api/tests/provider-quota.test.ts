import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { isProviderQuotaStatus, ProviderQuotaError, unavailableCode } from '../src/provider-quota';
import { serviceAccessToken } from '../src/service-account';

test('quota status maps to a fixed code without parsing provider bodies', () => {
  strictEqual(isProviderQuotaStatus(420), true);
  strictEqual(isProviderQuotaStatus(429), true);
  strictEqual(isProviderQuotaStatus(503), false);
  strictEqual(unavailableCode(new Response('private detail', { status: 429 }), 'firestore_unavailable'), 'provider_quota_exceeded');
  strictEqual(unavailableCode(new Response('private detail', { status: 503 }), 'firestore_unavailable'), 'firestore_unavailable');
});

test('OAuth token quota reports a fixed code without leaking provider details', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const account = JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) });
  const limited = async () => new Response('private provider detail', { status: 429 });
  await rejects(serviceAccessToken(account, 'ourfinance-test', limited as typeof fetch),
    (error: unknown) => error instanceof ProviderQuotaError && error.message === 'provider_quota_exceeded');
  const unavailable = async () => new Response('private provider detail', { status: 503 });
  await rejects(serviceAccessToken(account, 'ourfinance-test', unavailable as typeof fetch),
    (error: unknown) => error instanceof Error && error.message === 'Autorisation Google indisponible');
});
