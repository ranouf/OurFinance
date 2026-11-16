import { bearerToken, verifyFirebaseIdToken, verifyFirebaseVerifiedEmail } from './auth';
import { createGroup } from './groups';
import { createExpense, ExpenseError } from './expenses';
import { handleMedia } from './media';
import { MediaDiagnosticError } from './media-diagnostic';
import type { CloudinaryEnv } from './cloudinary';
import { readMember } from './firestore';

export interface Env extends Partial<CloudinaryEnv> {
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGIN: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  ENABLE_GROUP_CREATION?: string;
  ENABLE_MEDIA_POC?: string;
  ENABLE_EXPENSE_POC?: string;
  EXPENSE_POC_GROUP_ID?: string;
  MEDIA_POC_GROUP_ID?: string;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (origin && origin !== env.ALLOWED_ORIGIN) return new Response(JSON.stringify({ error: 'Origine refusée' }), { status: 403, headers });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return new Response(null, { status: 204, headers });
  }
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return new Response(JSON.stringify({ status: 'ok' }), { headers });
  const mediaMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/expenses\/([A-Za-z0-9_-]{1,128})\/attachments(?:\/([A-Za-z0-9_-]{1,128}))?$/.exec(url.pathname);
  if (mediaMatch && ((request.method === 'POST' && !mediaMatch[3]) || ((request.method === 'GET' || request.method === 'DELETE') && !!mediaMatch[3]))) {
    if (env.ENABLE_MEDIA_POC !== 'true' || !env.MEDIA_POC_GROUP_ID || env.MEDIA_POC_GROUP_ID !== mediaMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return new Response(JSON.stringify({ error: 'Médias non configurés' }), { status: 503, headers });
    try { return await handleMedia(request, { groupId: mediaMatch[1], expenseId: mediaMatch[2], attachmentId: mediaMatch[3] }, env as Required<Env>, headers); }
    catch (error) { return new Response(JSON.stringify({ error: 'Média indisponible', code: error instanceof MediaDiagnosticError ? error.code : 'internal' }), { status: 502, headers }); }
  }
  const expenseMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/expenses$/.exec(url.pathname);
  if (expenseMatch && request.method === 'POST') {
    if (env.ENABLE_EXPENSE_POC !== 'true' || env.EXPENSE_POC_GROUP_ID !== expenseMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Dépenses non configurées' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      if (Number(request.headers.get('Content-Length') ?? 0) > 8192) throw new ExpenseError(400, 'body_too_large');
      const raw = await request.text();
      if (raw.length > 8192) throw new ExpenseError(400, 'body_too_large');
      const expenseId = await createExpense(JSON.parse(raw), uid, expenseMatch[1], { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(JSON.stringify({ expenseId }), { status: 201, headers });
    } catch (error) {
      const status = error instanceof ExpenseError ? error.status : 503;
      const code = error instanceof ExpenseError ? error.code : 'expense_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
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
