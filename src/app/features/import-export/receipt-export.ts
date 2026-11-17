import type { User } from 'firebase/auth';

export interface ExportedReceipt {
  readonly filename: string;
  readonly contentType: 'image/png' | 'image/jpeg';
  readonly byteLength: number;
  readonly sha256: string;
  readonly bytes: Uint8Array;
}
const id = /^[A-Za-z0-9_-]{1,128}$/;
const maxBytes = 2_000_000;

/** Fetches a private receipt through the Worker; never exposes a signed Cloudinary URL. */
export async function downloadReceiptForExport(
  user: Pick<User, 'emailVerified' | 'getIdToken'>,
  workerUrl: string,
  groupId: string,
  expenseId: string,
  attachmentId: string,
  format: 'png' | 'jpg',
  transport: typeof fetch = fetch,
): Promise<ExportedReceipt> {
  if (!user.emailVerified || ![groupId, expenseId, attachmentId].every(value => id.test(value)) || !['png', 'jpg'].includes(format)) {
    throw new Error('Export de reçu non autorisé');
  }
  const base = new URL(workerUrl);
  if (base.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
  const endpoint = new URL(`/groups/${groupId}/expenses/${expenseId}/attachments/${attachmentId}`, base);
  const response = await transport(endpoint, {
    method: 'GET', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, redirect: 'error', cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Lecture du reçu refusée (HTTP ${response.status})`);
  const contentType = format === 'png' ? 'image/png' : 'image/jpeg';
  if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== contentType ||
      Number(response.headers.get('Content-Length') ?? 0) > maxBytes || !response.body) {
    throw new Error('Réponse de reçu invalide');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) { await reader.cancel(); throw new Error('Reçu trop volumineux'); }
    chunks.push(value);
  }
  if (!length) throw new Error('Reçu vide');
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  const validHeader = format === 'png' ? png.every((byte, index) => bytes[index] === byte) :
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!validHeader) throw new Error('Contenu du reçu invalide');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return { filename: `${groupId}/${expenseId}/${attachmentId}.${format}`, contentType, byteLength: length, sha256, bytes };
}
