import { bearerToken, verifyFirebaseIdToken } from './auth';
import { readMember } from './firestore';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGIN: string;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (origin && origin !== env.ALLOWED_ORIGIN) return new Response(JSON.stringify({ error: 'Origine refusée' }), { status: 403, headers });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return new Response(null, { status: 204, headers });
  }
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return new Response(JSON.stringify({ status: 'ok' }), { headers });
  const match = /^\/groups\/([A-Za-z0-9_-]{1,128})\/access$/.exec(url.pathname);
  if (!match || request.method !== 'GET') return new Response(JSON.stringify({ error: 'Route inconnue' }), { status: 404, headers });
  try {
    const token = bearerToken(request);
    const uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
    const member = await readMember(env.FIREBASE_PROJECT_ID, match[1], uid, token);
    if (!member || member.status !== 'active') return new Response(JSON.stringify({ error: 'Accès refusé' }), { status: 403, headers });
    return new Response(JSON.stringify({ groupId: match[1], role: member.role }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Authentification ou service indisponible' }), { status: 401, headers });
  }
}

export default { fetch: handleRequest };
