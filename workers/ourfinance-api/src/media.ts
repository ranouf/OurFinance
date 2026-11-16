import { bearerToken, verifyFirebaseIdToken } from './auth';
import { readMember } from './firestore';
import { serviceAccessToken } from './service-account';
import { fetchCloudinaryPrivate, MediaDiagnosticError } from './media-diagnostic';
import { authenticatedDownloadUrl, destroyAuthenticated, imageFormat, uploadAuthenticated, type CloudinaryEnv } from './cloudinary';

export interface MediaEnv extends CloudinaryEnv {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT_JSON: string;
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const string = (value: string) => ({ stringValue: value });

/** Firestore hides the receipt before remote deletion; a failed remote call remains retryable. */
export async function deleteReceiptAsset(path: string, publicId: string, alreadyDeleted: boolean, accessToken: string, env: MediaEnv, transport: typeof fetch = fetch): Promise<void> {
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const name = `${root}/${path}`;
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  if (!alreadyDeleted) {
    const update = await transport(`https://firestore.googleapis.com/v1/${root}:commit`, {
      method: 'POST', headers,
      body: JSON.stringify({ writes: [{ update: { name, fields: { status: string('deleted'), cleanupPending: { booleanValue: true }, deletedAt: { timestampValue: new Date().toISOString() } } }, updateMask: { fieldPaths: ['status', 'cleanupPending', 'deletedAt'] }, currentDocument: { exists: true } }] }),
    });
    if (!update.ok) throw new Error('Suppression logique refusée');
  }
  await destroyAuthenticated(publicId, env, transport);
  const cleared = await transport(`https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=cleanupPending`, {
    method: 'PATCH', headers, body: JSON.stringify({ fields: { cleanupPending: { booleanValue: false } } }),
  });
  if (!cleared.ok) throw new Error('Nettoyage du reçu non acquitté');
}

/** Read membership and expense in the same transaction as the metadata write. */
export async function persistUploadedReceipt(groupId: string, expenseId: string, attachmentId: string, uid: string, publicId: string, format: 'jpg' | 'png', accessToken: string, projectId: string, transport: typeof fetch = fetch): Promise<void> {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const begin = await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' });
  if (!begin.ok) throw new Error('Transaction média indisponible');
  const transaction = (await begin.json() as { transaction?: string }).transaction;
  if (!transaction) throw new Error('Transaction média invalide');
  let committed = false;
  try {
    const read = async (path: string): Promise<Record<string, { stringValue?: string; booleanValue?: boolean }> | null> => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Lecture transactionnelle refusée');
      return (await response.json() as { fields?: Record<string, { stringValue?: string; booleanValue?: boolean }> }).fields ?? null;
    };
    const group = await read(`groups/${groupId}`);
    const member = await read(`groups/${groupId}/members/${uid}`);
    const expense = await read(`groups/${groupId}/expenses/${expenseId}`);
    if (group?.['status']?.stringValue !== 'active' || member?.['status']?.stringValue !== 'active' || !expense || expense['deleted']?.booleanValue === true) {
      throw new Error('Groupe, membre ou dépense indisponible');
    }
    const response = await transport(`https://firestore.googleapis.com/v1/${root}:commit`, {
      method: 'POST', headers,
      body: JSON.stringify({ transaction, writes: [{ update: { name: `${root}/groups/${groupId}/expenses/${expenseId}/attachments/${attachmentId}`, fields: { publicId: string(publicId), format: string(format), type: string('authenticated'), status: string('active'), ownerId: string(uid), createdAt: { timestampValue: new Date().toISOString() } } }, currentDocument: { exists: false } }] }),
    });
    if (!response.ok) throw new Error('Écriture de la pièce jointe refusée');
    committed = true;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original failure. */ }
    }
  }
}

export async function readLimitedBody(request: Request, limit: number): Promise<Uint8Array> {
  if (!request.body) throw new Error('Corps absent');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new Error('Corps trop volumineux'); }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

async function firestoreDocument(path: string, token: string, env: MediaEnv, transport: typeof fetch = fetch): Promise<Record<string, { stringValue?: string; booleanValue?: boolean }> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const response = await transport(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Lecture Firestore refusée (${response.status})`);
  const body = await response.json() as { fields?: Record<string, { stringValue?: string; booleanValue?: boolean }> };
  return body.fields ?? null;
}

export async function handleMedia(request: Request, ids: { groupId: string; expenseId: string; attachmentId?: string }, env: MediaEnv, headers: Headers): Promise<Response> {
  const { groupId, expenseId, attachmentId } = ids;
  if (![groupId, expenseId, ...(attachmentId ? [attachmentId] : [])].every(id => idPattern.test(id))) return Response.json({ error: 'Identifiant invalide' }, { status: 400, headers });
  let uid: string, token: string;
  try {
    token = bearerToken(request);
    uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch { return Response.json({ error: 'Non authentifié' }, { status: 401, headers }); }
  let member;
  try { member = await readMember(env.FIREBASE_PROJECT_ID, groupId, uid, token); }
  catch { throw new MediaDiagnosticError('member_read'); }
  if (!member || member.status !== 'active') return Response.json({ error: 'Accès refusé' }, { status: 403, headers });
  const expensePath = `groups/${groupId}/expenses/${expenseId}`;
  let expense;
  try { expense = await firestoreDocument(expensePath, token, env); }
  catch { throw new MediaDiagnosticError('expense_read'); }
  if (!expense || expense['deleted']?.booleanValue === true) return Response.json({ error: 'Dépense absente' }, { status: 404, headers });

  if (request.method === 'POST' && !attachmentId) {
    if (Number(request.headers.get('Content-Length') ?? 0) > 2_000_000) return Response.json({ error: 'Image trop volumineuse' }, { status: 413, headers });
    let bytes: Uint8Array;
    try { bytes = await readLimitedBody(request, 2_000_000); }
    catch { return Response.json({ error: 'Image trop volumineuse ou absente' }, { status: 413, headers }); }
    let format: 'jpg' | 'png';
    try { format = imageFormat(bytes, request.headers.get('Content-Type') ?? ''); }
    catch { return Response.json({ error: 'Image invalide' }, { status: 400, headers }); }
    const id = crypto.randomUUID();
    const publicId = `ourfinance-test/${groupId}/${expenseId}/${id}`;
    await uploadAuthenticated(bytes, format, publicId, env);
    try {
      const accessToken = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID);
      await persistUploadedReceipt(groupId, expenseId, id, uid, publicId, format, accessToken, env.FIREBASE_PROJECT_ID);
      return Response.json({ attachmentId: id }, { status: 201, headers });
    } catch (error) {
      await destroyAuthenticated(publicId, env);
      throw error;
    }
  }
  if ((request.method === 'GET' || request.method === 'DELETE') && attachmentId) {
    let meta;
    try { meta = await firestoreDocument(`${expensePath}/attachments/${attachmentId}`, token, env); }
    catch { throw new MediaDiagnosticError('metadata_read'); }
    if (!meta || meta['type']?.stringValue !== 'authenticated' ||
        (meta['status']?.stringValue !== 'active' && !(request.method === 'DELETE' && meta['status']?.stringValue === 'deleted' && meta['cleanupPending']?.booleanValue === true))) {
      return Response.json({ error: 'Pièce jointe absente' }, { status: 404, headers });
    }
    if (request.method === 'DELETE' && meta['ownerId']?.stringValue !== uid && member.role !== 'owner') return Response.json({ error: 'Suppression refusée' }, { status: 403, headers });
    const publicId = meta['publicId']?.stringValue;
    const format = meta['format']?.stringValue;
    if (publicId !== `ourfinance-test/${groupId}/${expenseId}/${attachmentId}` || (format !== 'jpg' && format !== 'png')) return Response.json({ error: 'Métadonnées invalides' }, { status: 500, headers });
    if (request.method === 'DELETE') {
      const accessToken = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID);
      await deleteReceiptAsset(`${expensePath}/attachments/${attachmentId}`, publicId, meta['status']?.stringValue === 'deleted', accessToken, env);
      return new Response(null, { status: 204, headers });
    }
    let url: URL;
    try { url = await authenticatedDownloadUrl(publicId, format, env); }
    catch { throw new MediaDiagnosticError('download_sign'); }
    const upstream = await fetchCloudinaryPrivate(url);
    if (!upstream.ok) return Response.json({ error: 'Image indisponible' }, { status: 502, headers });
    headers.set('Content-Type', format === 'jpg' ? 'image/jpeg' : 'image/png');
    headers.set('Content-Disposition', 'inline');
    headers.set('X-Content-Type-Options', 'nosniff');
    try { return new Response(upstream.body, { status: 200, headers }); }
    catch { throw new MediaDiagnosticError('download_response'); }
  }
  return Response.json({ error: 'Méthode inconnue' }, { status: 405, headers });
}
