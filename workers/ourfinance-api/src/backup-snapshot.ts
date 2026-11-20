import { listCollectionPageInTransaction, readDocumentInTransaction } from './firestore-transaction-read';
import { unavailableCode } from './provider-quota';
import { collectGroupExportV2FromReader } from '../../../src/app/features/import-export/export-collector-v2';
import type { ExportDocument, ExportReader } from '../../../src/app/features/import-export/export-collector';
import { serviceAccessToken } from './service-account';
import { listExpenseDescendants } from './firestore-descendants';

export interface BackupSnapshotEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string }
export class BackupSnapshotError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;

function decodeValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') throw new BackupSnapshotError(503, 'invalid_document');
  const item = value as Record<string, unknown>;
  if ('stringValue' in item) return item['stringValue'];
  if ('booleanValue' in item) return item['booleanValue'];
  if ('timestampValue' in item) return new Date(item['timestampValue'] as string).toISOString();
  if ('integerValue' in item) {
    const number = Number(item['integerValue']);
    if (!Number.isSafeInteger(number)) throw new BackupSnapshotError(503, 'invalid_document');
    return number;
  }
  if ('arrayValue' in item) return ((item['arrayValue'] as { values?: unknown[] }).values ?? []).map(decodeValue);
  if ('mapValue' in item) return decodeFields((item['mapValue'] as { fields?: Record<string, unknown> }).fields ?? {});
  if ('nullValue' in item) return null;
  throw new BackupSnapshotError(503, 'unsupported_field');
}
function decodeFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

/** One owner-authorized Firestore read transaction for all V2 JSON fields. */
export async function collectBackupSnapshotV2(uid: string, groupId: string, env: BackupSnapshotEnv, transport: typeof fetch = fetch): Promise<string> {
  if (!idPattern.test(uid) || !idPattern.test(groupId)) throw new BackupSnapshotError(400, 'invalid_path');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const checked = async (response: Response) => {
    if (!response.ok) throw new BackupSnapshotError(response.status === 409 ? 409 : 503, unavailableCode(response, 'firestore_unavailable'));
    return await response.json() as Record<string, unknown>;
  };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, {
    method: 'POST', headers, body: JSON.stringify({ options: { readOnly: {} } }),
  }));
  if (typeof begin['transaction'] !== 'string') throw new BackupSnapshotError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let count = 0;
  const descendantCache = new Map<'attachments' | 'comments', Promise<Map<string, { name: string; fields?: Record<string, unknown> }[]>>>();
  try {
    const decodeDocument = (value: Record<string, unknown>, prefix: string): ExportDocument => {
      const name = value['name'];
      if (typeof name !== 'string' || !name.startsWith(`${root}/${prefix}/`)) throw new BackupSnapshotError(503, 'invalid_document');
      const id = name.slice(`${root}/${prefix}/`.length);
      if (!idPattern.test(id) || !value['fields'] || typeof value['fields'] !== 'object') throw new BackupSnapshotError(503, 'invalid_document');
      return { id, data: decodeFields(value['fields'] as Record<string, unknown>) };
    };
    const reader: ExportReader = {
      read: async path => {
        const response = await readDocumentInTransaction(root, path, transaction, headers, transport);
        if (response.status === 404) return null;
        const document = await checked(response);
        const decoded = decodeDocument(document, path.slice(0, path.lastIndexOf('/')));
        if (decoded.id !== path.slice(path.lastIndexOf('/') + 1)) throw new BackupSnapshotError(503, 'invalid_document');
        return decoded;
      },
      list: async path => {
        const nested = new RegExp(`^groups/${groupId}/expenses/[A-Za-z0-9_-]{1,128}/(attachments|comments)$`).exec(path);
        if (nested) {
          const kind = nested[1] as 'attachments' | 'comments';
          if (!descendantCache.has(kind)) descendantCache.set(kind, listExpenseDescendants(root, groupId, kind, transaction, headers, transport).then(result => {
            count += [...result.values()].reduce((sum, page) => sum + page.length, 0);
            if (count > 5000) throw new BackupSnapshotError(409, 'snapshot_too_large');
            return result;
          }));
          return (await descendantCache.get(kind)!).get(path)?.map(row => decodeDocument(row as Record<string, unknown>, path)) ?? [];
        }
        const documents: ExportDocument[] = [];
        let pageToken: string | undefined;
        let pages = 0;
        do {
          if (++pages > 100) throw new BackupSnapshotError(409, 'snapshot_too_large');
          const page = await checked(await listCollectionPageInTransaction(root, path, 100, transaction, headers, transport, pageToken));
          if (page['documents'] !== undefined && !Array.isArray(page['documents'])) throw new BackupSnapshotError(503, 'invalid_document');
          const rows = (page['documents'] ?? []) as Record<string, unknown>[];
          count += rows.length;
          if (count > 5000) throw new BackupSnapshotError(409, 'snapshot_too_large');
          documents.push(...rows.map(row => decodeDocument(row, path)));
          pageToken = typeof page['nextPageToken'] === 'string' ? page['nextPageToken'] : undefined;
        } while (pageToken);
        return documents;
      },
    };
    const group = await reader.read(`groups/${groupId}`);
    const caller = await reader.read(`groups/${groupId}/members/${uid}`);
    if (!['active', 'archived'].includes(String(group?.data['status'])) || caller?.data['status'] !== 'active' || caller.data['role'] !== 'owner') {
      throw new BackupSnapshotError(403, 'owner_required');
    }
    return await collectGroupExportV2FromReader(reader, { uid, emailVerified: true }, groupId);
  } finally {
    try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
    catch { /* Snapshot expires if rollback fails. */ }
  }
}
