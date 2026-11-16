import { bearerToken, verifyFirebaseIdToken, verifyFirebaseVerifiedEmail } from './auth';
import { createGroup } from './groups';
import { readMember } from './firestore';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGIN: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  ENABLE_GROUP_CREATION?: string;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (origin && origin !== env.ALLOWED_ORIGIN) return new Response(JSON.stringify({ error: 'Origine refusée' }), { status: 403, headers });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return new Response(null, { status: 204, headers });
  }
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return new Response(JSON.stringify({ status: 'ok' }), { headers });
  if (url.pathname === '/groups' && request.method === 'POST') {
    if (!env.FIREBASE_SERVICE_ACCOUNT_JSON || env.ENABLE_GROUP_CREATION !== 'true') return new Response(JSON.stringify({ error: 'Création non configurée' }), { status: 503, headers });
    try {
      const token = bearerToken(request);
      const uid = await verifyFirebaseVerifiedEmail(token, env.FIREBASE_PROJECT_ID);
      if (Number(request.headers.get('Content-Length') ?? 0) > 4096) throw new Error('Corps trop volumineux');
      const raw = await request.text();
      if (raw.length > 4096) throw new Error('Corps trop volumineux');
      const body: unknown = JSON.parse(raw);
      const groupId = await createGroup(body, uid, { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(JSON.stringify({ groupId }), { status: 201, headers });
    } catch { return new Response(JSON.stringify({ error: 'Création impossible' }), { status: 400, headers }); }
  }
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
