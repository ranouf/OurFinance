import { test } from 'node:test';
import { strictEqual, rejects } from 'node:assert';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyFirebaseIdToken } from '../src/auth';

test('Firebase token requires valid issuer, audience, expiration and signature', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test' }] });
  const sign = (audience: string, issuer = 'https://securetoken.google.com/ourfinance-test') => new SignJWT({ sub: 'alice' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(issuer).setAudience(audience).setExpirationTime('5m').sign(privateKey);
  strictEqual(await verifyFirebaseIdToken(await sign('ourfinance-test'), 'ourfinance-test', keys), 'alice');
  await rejects(verifyFirebaseIdToken(await sign('other'), 'ourfinance-test', keys));
  await rejects(verifyFirebaseIdToken(await sign('ourfinance-test', 'https://wrong.example'), 'ourfinance-test', keys));
});
