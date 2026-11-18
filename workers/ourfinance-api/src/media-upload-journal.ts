import { destroyAuthenticated, type CloudinaryEnv } from './cloudinary';
import { isProviderQuotaStatus, ProviderQuotaError } from './provider-quota';

export interface UploadJournalEnv extends CloudinaryEnv { readonly FIREBASE_PROJECT_ID: string }

const string = (value: string) => ({ stringValue: value });
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const staleAfterMs = 15 * 60 * 1000;

function root(projectId: string): string {
  return `projects/${projectId}/databases/(default)/documents`;
}

export function uploadJournalPath(groupId: string, attachmentId: string): string {
  return `groups/${groupId}/receiptUploadJobs/${attachmentId}`;
}

async function checked(response: Response): Promise<Response> {
  if (isProviderQuotaStatus(response.status)) throw new ProviderQuotaError();
  if (!response.ok) throw new Error(`Journal média indisponible (${response.status})`);
  return response;
}

/** A server-only record exists before Cloudinary can create the private asset. */
export async function createUploadJournal(groupId: string, expenseId: string, attachmentId: string, uid: string,
  publicId: string, format: 'jpg' | 'png', token: string, env: UploadJournalEnv, transport: typeof fetch = fetch): Promise<void> {
  const base = root(env.FIREBASE_PROJECT_ID);
  const name = `${base}/${uploadJournalPath(groupId, attachmentId)}`;
  await checked(await transport(`https://firestore.googleapis.com/v1/${base}:commit`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{ update: { name, fields: {
      expenseId: string(expenseId), ownerId: string(uid), publicId: string(publicId), format: string(format),
      status: string('uploading'), createdAt: { timestampValue: new Date().toISOString() },
    } }, currentDocument: { exists: false } }] }),
  }));
}

/** This write conflicts with a concurrent transaction trying to activate the receipt. */
async function markCleanupPending(name: string, token: string, transport: typeof fetch): Promise<boolean> {
  const response = await transport(`https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=status&currentDocument.exists=true`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: string('cleanup_pending') } }),
  });
  if (response.status === 404 || response.status === 409 || response.status === 412) return false;
  await checked(response);
  return true;
}

async function attachmentExists(groupId: string, expenseId: string, attachmentId: string, publicId: string,
  token: string, env: UploadJournalEnv, transport: typeof fetch): Promise<boolean> {
  const name = `${root(env.FIREBASE_PROJECT_ID)}/groups/${groupId}/expenses/${expenseId}/attachments/${attachmentId}`;
  const response = await transport(`https://firestore.googleapis.com/v1/${name}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return false;
  await checked(response);
  const fields = (await response.json() as { fields?: Record<string, { stringValue?: string }> }).fields;
  if (fields?.['publicId']?.stringValue !== publicId || fields['type']?.stringValue !== 'authenticated') {
    throw new Error('Métadonnée média contradictoire');
  }
  return true;
}

async function removeJournal(name: string, token: string, transport: typeof fetch): Promise<void> {
  const response = await transport(`https://firestore.googleapis.com/v1/${name}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status !== 404) await checked(response);
}

/** Returns true when a transaction actually committed despite an ambiguous response. */
export async function recoverFailedUpload(groupId: string, expenseId: string, attachmentId: string, publicId: string,
  token: string, env: UploadJournalEnv, transport: typeof fetch = fetch): Promise<boolean> {
  const name = `${root(env.FIREBASE_PROJECT_ID)}/${uploadJournalPath(groupId, attachmentId)}`;
  const marked = await markCleanupPending(name, token, transport);
  if (!marked) {
    // A successful transaction deletes the journal atomically with the attachment.
    return attachmentExists(groupId, expenseId, attachmentId, publicId, token, env, transport);
  }
  if (await attachmentExists(groupId, expenseId, attachmentId, publicId, token, env, transport)) {
    await removeJournal(name, token, transport);
    return true;
  }
  await destroyAuthenticated(publicId, env, transport);
  await removeJournal(name, token, transport);
  return false;
}

/** Owner-only retry, bounded to eight records for the Worker Free subrequest budget. */
export async function cleanupUploadJournals(groupId: string, token: string, env: UploadJournalEnv,
  transport: typeof fetch = fetch, now = Date.now()): Promise<{ cleaned: number; pending: number }> {
  const base = root(env.FIREBASE_PROJECT_ID);
  const response = await checked(await transport(`https://firestore.googleapis.com/v1/${base}/groups/${groupId}/receiptUploadJobs?pageSize=9`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  const page = await response.json() as { documents?: Array<{ name?: string; fields?: Record<string, { stringValue?: string; timestampValue?: string }> }>; nextPageToken?: string };
  if (page.documents !== undefined && !Array.isArray(page.documents)) throw new Error('Journal média invalide');
  const rows = page.documents ?? [];
  let cleaned = 0;
  let pending = rows.length > 8 || !!page.nextPageToken ? 1 : 0;
  for (const row of rows.slice(0, 8)) {
    const name = row.name;
    const id = name?.slice(name.lastIndexOf('/') + 1);
    const fields = row.fields;
    const expenseId = fields?.['expenseId']?.stringValue;
    const publicId = fields?.['publicId']?.stringValue;
    const status = fields?.['status']?.stringValue;
    const createdAt = Date.parse(fields?.['createdAt']?.timestampValue ?? '');
    if (!name?.startsWith(`${base}/${uploadJournalPath(groupId, '')}`) || !id || !idPattern.test(id) ||
        !expenseId || !idPattern.test(expenseId) || publicId !== `${env.FIREBASE_PROJECT_ID}/${groupId}/${expenseId}/${id}` ||
        (status !== 'uploading' && status !== 'cleanup_pending') || !Number.isFinite(createdAt)) throw new Error('Journal média invalide');
    if (status === 'uploading' && now - createdAt < staleAfterMs) { pending++; continue; }
    try {
      if (status === 'uploading' && !await markCleanupPending(name, token, transport)) { pending++; continue; }
      if (!await attachmentExists(groupId, expenseId, id, publicId, token, env, transport)) {
        await destroyAuthenticated(publicId, env, transport);
      }
      await removeJournal(name, token, transport);
      cleaned++;
    } catch { pending++; }
  }
  return { cleaned, pending };
}
