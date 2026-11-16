import { test } from 'node:test';
import { strictEqual, rejects } from 'node:assert';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyFirebaseIdToken, verifyFirebaseVerifiedIdentity } from '../src/auth';

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
test('invitation identity requires a verified email claim', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test' }] });
  const sign = (verified: boolean) => new SignJWT({ sub: 'guest', email: 'GUEST@EXAMPLE.COM', email_verified: verified })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://securetoken.google.com/ourfinance-test').setAudience('ourfinance-test').setExpirationTime('5m').sign(privateKey);
  strictEqual((await verifyFirebaseVerifiedIdentity(await sign(true), 'ourfinance-test', keys)).email, 'guest@example.com');
  await rejects(verifyFirebaseVerifiedIdentity(await sign(false), 'ourfinance-test', keys));
});
