import { importPKCS8, SignJWT } from 'jose';
import { isProviderQuotaStatus, ProviderQuotaError } from './provider-quota';

export interface ServiceAccount {
  readonly client_email: string;
  readonly private_key: string;
  readonly project_id: string;
}

export async function serviceAccessToken(json: string, expectedProjectId: string, transport: typeof fetch = fetch): Promise<string> {
  const account = JSON.parse(json) as ServiceAccount;
  if (account.project_id !== expectedProjectId || !account.client_email?.endsWith('.gserviceaccount.com') || !account.private_key?.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Identité serveur invalide');
  }
  const key = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('50m')
    .sign(key);
  const response = await transport('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (isProviderQuotaStatus(response.status)) throw new ProviderQuotaError();
  if (!response.ok) throw new Error('Autorisation Google indisponible');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('access_token' in body) || typeof body.access_token !== 'string') throw new Error('Jeton Google invalide');
  return body.access_token;
}
