import { serviceAccessToken } from './service-account';

export interface RestoreInventoryEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string }
export interface LiveRestoreInventory {
  readonly groupDocuments: readonly string[];
  readonly userDocuments: readonly string[];
  readonly receiptPublicIds: readonly string[];
}
export class RestoreInventoryError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
type Field = { stringValue?: string };
type Document = { name?: string; fields?: Record<string, Field> };

/** Owner-only read transaction; no restoration write is issued here. */
export async function collectLiveRestoreInventory(uid: string, groupId: string, env: RestoreInventoryEnv, transport: typeof fetch = fetch, restoreId?: string): Promise<LiveRestoreInventory> {
  if (!idPattern.test(uid) || !idPattern.test(groupId) || (restoreId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(restoreId))) throw new RestoreInventoryError(400, 'invalid_path');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const checked = async (response: Response): Promise<Record<string, unknown>> => {
    if (!response.ok) throw new RestoreInventoryError(response.status === 409 ? 409 : 503, 'firestore_unavailable');
    return await response.json() as Record<string, unknown>;
  };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new RestoreInventoryError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let count = 0;
  try {
    const read = async (path: string): Promise<Document | null> => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      return response.status === 404 ? null : await checked(response) as Document;
    };
    const list = async (path: string): Promise<Document[]> => {
      const documents: Document[] = [];
      let pageToken: string | undefined;
      let pages = 0;
      do {
        if (++pages > 100) throw new RestoreInventoryError(409, 'inventory_too_large');
        const url = new URL(`https://firestore.googleapis.com/v1/${root}/${path}`);
        url.searchParams.set('transaction', transaction);
        url.searchParams.set('pageSize', '100');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const page = await checked(await transport(url, { headers }));
        if (page['documents'] !== undefined && !Array.isArray(page['documents'])) throw new RestoreInventoryError(503, 'invalid_inventory');
        const rows = (page['documents'] ?? []) as Document[];
        count += rows.length;
        if (count > 5000) throw new RestoreInventoryError(409, 'inventory_too_large');
        for (const row of rows) {
          const id = row.name?.slice(`${root}/${path}/`.length);
          if (!row.name?.startsWith(`${root}/${path}/`) || !id || !idPattern.test(id)) throw new RestoreInventoryError(503, 'invalid_inventory');
        }
        documents.push(...rows);
        pageToken = typeof page['nextPageToken'] === 'string' ? page['nextPageToken'] : undefined;
      } while (pageToken);
      return documents;
    };
    const assertCollections = async (path: string, allowed: ReadonlySet<string>): Promise<void> => {
      let pageToken: string | undefined;
      let pages = 0;
      do {
        if (++pages > 100) throw new RestoreInventoryError(409, 'inventory_too_large');
        const body = { pageSize: 100, ...(pageToken ? { pageToken } : {}) };
        const response = await checked(await transport(`https://firestore.googleapis.com/v1/${root}/${path}:listCollectionIds`, {
          method: 'POST', headers, body: JSON.stringify(body),
        }));
        if (response['collectionIds'] !== undefined && !Array.isArray(response['collectionIds'])) throw new RestoreInventoryError(503, 'invalid_inventory');
        if (((response['collectionIds'] ?? []) as unknown[]).some(id => typeof id !== 'string' || !allowed.has(id))) {
          throw new RestoreInventoryError(409, 'unknown_collection');
        }
        pageToken = typeof response['nextPageToken'] === 'string' ? response['nextPageToken'] : undefined;
      } while (pageToken);
    };
    const group = await read(`groups/${groupId}`);
    const caller = await read(`groups/${groupId}/members/${uid}`);
    const expectedStatus = restoreId ? 'restoring' : 'active';
    if (group?.fields?.['status']?.stringValue !== expectedStatus ||
        (restoreId && group.fields['restoreId']?.stringValue !== restoreId) ||
        caller?.fields?.['status']?.stringValue !== 'active' || caller.fields['role']?.stringValue !== 'owner') throw new RestoreInventoryError(403, 'owner_required');
    const groupCollections = ['members', 'categories', 'expenses', 'settlements', 'importedRecords', 'activity', 'balances', 'statistics', 'invitations'];
    await assertCollections(`groups/${groupId}`, new Set(groupCollections));
    const pages = await Promise.all(groupCollections.map(name => list(`groups/${groupId}/${name}`)));
    const groupDocuments = [`groups/${groupId}`, ...pages.flatMap(page => page.map(row => row.name!.slice(`${root}/`.length)))];
    const members = pages[0].map(row => row.name!.slice(row.name!.lastIndexOf('/') + 1));
    if (!members.includes(uid)) throw new RestoreInventoryError(503, 'invalid_members');
    const receiptPublicIds: string[] = [];
    for (const expense of pages[2]) {
      const expensePath = expense.name!.slice(`${root}/`.length);
      await assertCollections(expensePath, new Set(['comments', 'attachments']));
      for (const name of ['comments', 'attachments']) {
        for (const row of await list(`${expensePath}/${name}`)) {
          groupDocuments.push(row.name!.slice(`${root}/`.length));
          if (name === 'attachments') {
            const publicId = row.fields?.['publicId']?.stringValue;
            if (publicId) receiptPublicIds.push(publicId);
          }
        }
      }
    }
    const userDocuments: string[] = [];
    for (const memberId of members) {
      for (const kind of ['groupMemberships', 'groupPreferences']) {
        const path = `users/${memberId}/${kind}/${groupId}`;
        if (await read(path)) userDocuments.push(path);
      }
      for (const batch of await list(`users/${memberId}/importBatches`)) {
        if (batch.fields?.['groupId']?.stringValue === groupId) userDocuments.push(batch.name!.slice(`${root}/`.length));
      }
    }
    if (new Set(groupDocuments).size !== groupDocuments.length || new Set(userDocuments).size !== userDocuments.length) throw new RestoreInventoryError(503, 'invalid_inventory');
    return { groupDocuments, userDocuments, receiptPublicIds };
  } finally {
    try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
    catch { /* The read transaction expires if rollback fails. */ }
  }
}
