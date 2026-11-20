import { readDocumentInTransaction } from './firestore-transaction-read';
import { unavailableCode } from './provider-quota';
import { categoryColors, categoryIcons } from '../../../src/app/shared/utils/categories';
import { serviceAccessToken } from './service-account';

export interface CategoryEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export class CategoryError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^custom_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const string = (stringValue: string) => ({ stringValue });
const field = (doc: Record<string, unknown> | null, key: string) => (doc?.['fields'] as Record<string, { stringValue?: string }> | undefined)?.[key]?.stringValue;

function parse(value: unknown): { name: string; iconId: string; color: string; status: 'active' | 'archived' } {
  if (!value || typeof value !== 'object') throw new CategoryError(400, 'invalid_category');
  const input = value as Record<string, unknown>;
  if (typeof input['name'] !== 'string' || !input['name'].trim() || input['name'].trim().length > 40 ||
      !categoryIcons.some(icon => icon.id === input['iconId']) ||
      !categoryColors.some(color => color.id === input['color']) ||
      (input['status'] !== undefined && input['status'] !== 'active' && input['status'] !== 'archived')) throw new CategoryError(400, 'invalid_category');
  return { name: input['name'].trim(), iconId: input['iconId'] as string, color: input['color'] as string, status: (input['status'] ?? 'active') as 'active' | 'archived' };
}

async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new CategoryError(response.status === 409 ? 409 : 503, response.status === 409 ? 'category_conflict' : unavailableCode(response, 'firestore_unavailable'));
  return await response.json() as Record<string, unknown>;
}

export async function writeCategory(value: unknown, uid: string, groupId: string, categoryId: string, mode: 'create' | 'update', env: CategoryEnv, transport: typeof fetch = fetch): Promise<string> {
  if (!idPattern.test(categoryId) || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId) || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new CategoryError(400, 'invalid_category_id');
  const category = parse(value);
  if (mode === 'update' && (value as Record<string, unknown>)['status'] === undefined) throw new CategoryError(400, 'invalid_category');
  if (mode === 'create' && category.status !== 'active') throw new CategoryError(400, 'invalid_category');
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new CategoryError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await readDocumentInTransaction(root, path, transaction, headers, transport);
      if (response.status === 404) return null;
      return await checked(response);
    };
    if (field(await read(`groups/${groupId}`), 'status') !== 'active' ||
        field(await read(`groups/${groupId}/members/${uid}`), 'status') !== 'active') throw new CategoryError(403, 'member_inactive');
    const previous = mode === 'update' ? await read(`groups/${groupId}/categories/${categoryId}`) : null;
    if (mode === 'update' && !previous) throw new CategoryError(403, 'category_missing');
    const now = new Date().toISOString();
    const fields = { name: string(category.name), iconId: string(category.iconId), color: string(category.color), status: string(category.status), updatedBy: string(uid), updatedAt: { timestampValue: now } };
    const categoryWrite = mode === 'create'
      ? { update: { name: `${root}/groups/${groupId}/categories/${categoryId}`, fields: { ...fields, createdBy: string(uid), createdAt: { timestampValue: now } } }, currentDocument: { exists: false } }
      : { update: { name: `${root}/groups/${groupId}/categories/${categoryId}`, fields }, updateMask: { fieldPaths: Object.keys(fields) } };
    const action = mode === 'create' ? 'category_created' : category.status !== field(previous, 'status') ? category.status === 'archived' ? 'category_archived' : 'category_reactivated' : 'category_updated';
    const activityId = `category_${crypto.randomUUID()}`;
    const writes = [categoryWrite, { update: { name: `${root}/groups/${groupId}/activity/${activityId}`, fields: { actorId: string(uid), action: string(action), categoryId: string(categoryId), at: { timestampValue: now } } }, currentDocument: { exists: false } }];
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
    committed = true;
    return categoryId;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}
