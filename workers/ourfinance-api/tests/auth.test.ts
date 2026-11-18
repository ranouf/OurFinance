import { test } from 'node:test';
import { strictEqual, rejects, throws } from 'node:assert';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { bearerToken, verifyFirebaseIdToken, verifyFirebaseVerifiedIdentity } from '../src/auth';

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

test('bearer header rejects missing and blank tokens', () => {
  strictEqual(bearerToken(new Request('https://worker.test', { headers: { Authorization: 'Bearer fixture' } })), 'fixture');
  for (const headers of [{}, { Authorization: 'Basic fixture' }, { Authorization: 'Bearer ' }, { Authorization: 'Bearer    ' }]) {
    throws(() => bearerToken(new Request('https://worker.test', { headers })));
  }
});

test('verified identity rejects malformed subject and email claims', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test-extra' }] });
  const sign = (claims: Record<string, unknown>) => new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-extra' })
    .setIssuer('https://securetoken.google.com/ourfinance-test').setAudience('ourfinance-test').setExpirationTime('5m').sign(privateKey);
  for (const claims of [
    { sub: '', email: 'guest@example.com', email_verified: true },
    { sub: 'x'.repeat(129), email: 'guest@example.com', email_verified: true },
    { sub: 'alice', email: 'bad', email_verified: true },
    { sub: 'alice', email: 'a'.repeat(250) + '@example.com', email_verified: true },
    { sub: 'alice', email: 'guest@example.com', email_verified: false },
  ]) {
    const token = await sign(claims);
    await rejects(verifyFirebaseVerifiedIdentity(token, 'ourfinance-test', keys));
  }
  await rejects(verifyFirebaseIdToken(await sign({ sub: 'x'.repeat(129) }), 'ourfinance-test', keys));
});
