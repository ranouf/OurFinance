import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

/** Verify signature, issuer, audience and expiration; never trust decoded claims alone. */
export async function verifyFirebaseIdToken(token: string, projectId: string, keySet: JWTVerifyGetKey = googleKeys): Promise<string> {
  const { payload } = await jwtVerify(token, keySet, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new Error('Identité invalide');
  return payload.sub;
}

export function bearerToken(request: Request): string {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ') || !header.slice(7).trim()) throw new Error('Jeton absent');
  return header.slice(7).trim();
}

export async function verifyFirebaseVerifiedEmail(token: string, projectId: string, keySet: JWTVerifyGetKey = googleKeys): Promise<string> {
  const { payload } = await jwtVerify(token, keySet, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (payload.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw new Error('Adresse courriel non vérifiée');
  }
  return payload.sub;
}
