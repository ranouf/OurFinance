import { unavailableCode } from './provider-quota';
import { splitAmount, validateExpense, type Allocation, type SplitMode } from '../../../src/app/shared/utils/split-engine';
import { categories, categoryById, categoryIcons, isCustomCategoryId, type CategoryColor, type CategoryDefinition } from '../../../src/app/shared/utils/categories';
import { serviceAccessToken } from './service-account';
import { destroyAuthenticated, type CloudinaryEnv } from './cloudinary';

export interface ExpenseEnv extends Partial<CloudinaryEnv> { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export interface ExpenseInput {
  readonly idempotencyKey: string;
  readonly description: string;
  readonly categoryId: string;
  readonly currency: string;
  readonly date: string;
  readonly amountMinor: number;
  readonly payments: readonly Allocation[];
  readonly splitMode: SplitMode;
}
export class ExpenseError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const string = (stringValue: string) => ({ stringValue });
const integer = (value: number) => ({ integerValue: String(value) });
const amountEntries = (entries: readonly Allocation[]) => ({ arrayValue: { values: entries.map(item => ({ mapValue: { fields: { userId: string(item.userId), amountMinor: integer(item.amountMinor) } } })) } });

export function parseExpense(value: unknown): ExpenseInput {
  if (!value || typeof value !== 'object') throw new ExpenseError(400, 'invalid_expense');
  const input = value as Record<string, unknown>;
  if (typeof input['idempotencyKey'] !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(input['idempotencyKey']) ||
      typeof input['description'] !== 'string' || !input['description'].trim() || input['description'].length > 160 ||
      (input['categoryId'] !== undefined && (typeof input['categoryId'] !== 'string' || (!categories.some(category => category.id === input['categoryId']) && !isCustomCategoryId(input['categoryId'])))) ||
      typeof input['currency'] !== 'string' || !Intl.supportedValuesOf('currency').includes(input['currency']) ||
      typeof input['date'] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input['date']) || !validDate(input['date']) ||
      !Number.isSafeInteger(input['amountMinor']) || (input['amountMinor'] as number) <= 0 ||
      !Array.isArray(input['payments']) || input['payments'].length < 1 || input['payments'].length > 20 ||
      !input['splitMode'] || typeof input['splitMode'] !== 'object') throw new ExpenseError(400, 'invalid_expense');
  const payments = input['payments'] as Allocation[];
  if (payments.some(item => !item || typeof item.userId !== 'string' || !idPattern.test(item.userId) || !Number.isSafeInteger(item.amountMinor))) throw new ExpenseError(400, 'invalid_payments');
  const splitMode = input['splitMode'] as SplitMode;
  if (!['equal', 'exact', 'percentage', 'shares', 'adjustment'].includes(splitMode.kind)) throw new ExpenseError(400, 'invalid_split');
  let participants: string[];
  try { participants = modeUsers(splitMode); }
  catch { throw new ExpenseError(400, 'invalid_participants'); }
  if (participants.length < 1 || participants.length > 20 || participants.some(id => !idPattern.test(id))) throw new ExpenseError(400, 'invalid_participants');
  try {
    const allocations = splitAmount(input['amountMinor'] as number, splitMode);
    validateExpense(input['amountMinor'] as number, payments, allocations, new Set([...payments, ...allocations].map(item => item.userId)));
  } catch { throw new ExpenseError(400, 'unbalanced_expense'); }
  return { idempotencyKey: input['idempotencyKey'], description: input['description'].trim(), categoryId: (input['categoryId'] ?? 'other') as string, currency: input['currency'], date: input['date'], amountMinor: input['amountMinor'] as number, payments, splitMode };
}

function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function modeUsers(mode: SplitMode): string[] {
  if (mode.kind === 'equal') return Array.isArray(mode.users) ? [...mode.users] : [];
  if (mode.kind === 'exact') return Array.isArray(mode.amounts) ? mode.amounts.map(item => item.userId) : [];
  if (mode.kind === 'percentage') return Array.isArray(mode.weightsBasisPoints) ? mode.weightsBasisPoints.map(item => item.userId) : [];
  if (mode.kind === 'shares') return Array.isArray(mode.weights) ? mode.weights.map(item => item.userId) : [];
  return Array.isArray(mode.adjustments) ? mode.adjustments.map(item => item.userId) : [];
}

async function json(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new ExpenseError(response.status === 409 ? 409 : 503, response.status === 409 ? 'transaction_conflict' : unavailableCode(response, 'firestore_unavailable'));
  return await response.json() as Record<string, unknown>;
}

/** Firestore transaction rechecks all active members before the atomic writes. */
export async function createExpense(value: unknown, uid: string, groupId: string, env: ExpenseEnv, transport: typeof fetch = fetch): Promise<string> {
  if (!idPattern.test(groupId) || !idPattern.test(uid)) throw new ExpenseError(400, 'invalid_group');
  const expense = parseExpense(value);
  const allocations = splitAmount(expense.amountMinor, expense.splitMode);
  const members = [...new Set([uid, ...expense.payments.map(item => item.userId), ...allocations.map(item => item.userId)])];
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const begin = await json(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new ExpenseError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
  const read = async (path: string) => {
    const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
    if (response.status === 404) return null;
    return await json(response);
  };
  const group = await read(`groups/${groupId}`);
  const groupFields = group?.['fields'] as Record<string, { stringValue?: string }> | undefined;
  if (!groupFields || groupFields['status']?.stringValue !== 'active') throw new ExpenseError(403, 'group_inactive');
  if ((groupFields['currencyCode']?.stringValue ?? groupFields['currency']?.stringValue) !== expense.currency) throw new ExpenseError(400, 'currency_mismatch');
  for (const memberId of members) {
    const record = await read(`groups/${groupId}/members/${memberId}`);
    const fields = record?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    if (!fields || fields['status']?.stringValue !== 'active') throw new ExpenseError(403, 'member_inactive');
  }
  let category: CategoryDefinition = categoryById(expense.categoryId);
  if (isCustomCategoryId(expense.categoryId)) {
    const stored = await read(`groups/${groupId}/categories/${expense.categoryId}`);
    const fields = stored?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    const icon = categoryIcons.find(item => item.id === fields?.['iconId']?.stringValue);
    if (fields?.['status']?.stringValue !== 'active' || !fields['name']?.stringValue || !icon || !fields['color']?.stringValue) throw new ExpenseError(403, 'category_unavailable');
    category = { id: expense.categoryId, label: fields['name'].stringValue, icon: icon.glyph, color: fields['color'].stringValue as CategoryColor };
  }
  validateExpense(expense.amountMinor, expense.payments, allocations, new Set(members));
  const expenseId = expense.idempotencyKey;
  const now = new Date().toISOString();
  const write = (path: string, fields: Record<string, unknown>, exists?: boolean) => ({ update: { name: `${root}/${path}`, fields }, ...(exists === undefined ? {} : { currentDocument: { exists } }) });
  const writes: unknown[] = [
    write(`groups/${groupId}/expenses/${expenseId}`, {
      description: string(expense.description), categoryId: string(expense.categoryId), categoryLabel: string(category.label), categoryIcon: string(category.icon), categoryColor: string(category.color), currency: string(expense.currency), date: string(expense.date), amountMinor: integer(expense.amountMinor), createdBy: string(uid), createdAt: { timestampValue: now },
      payments: amountEntries(expense.payments), allocations: amountEntries(allocations), splitSnapshotJson: string(JSON.stringify(expense.splitMode)), deleted: { booleanValue: false }, revision: integer(0),
    }, false),
    write(`users/${uid}/groupPreferences/${groupId}`, {
      modeJson: string(JSON.stringify(expense.splitMode)), memberIds: { arrayValue: { values: allocations.map(item => string(item.userId)) } }, updatedAt: { timestampValue: now },
    }),
    write(`groups/${groupId}/activity/${expenseId}`, { actorId: string(uid), action: string('expense_created'), expenseId: string(expenseId), at: { timestampValue: now } }, false),
  ];
  if (!groupFields['currencyLockedAt']) writes.push({ update: { name: `${root}/groups/${groupId}`, fields: { currencyLockedAt: { timestampValue: now } } }, updateMask: { fieldPaths: ['currencyLockedAt'] } });
  await json(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
  committed = true;
  return expenseId;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}

/** Update or logically delete only the author's expense at the expected revision. */
export async function mutateExpense(value: unknown, uid: string, groupId: string, expenseId: string, method: 'PATCH' | 'DELETE', env: ExpenseEnv, transport: typeof fetch = fetch): Promise<void> {
  if (!idPattern.test(groupId) || !idPattern.test(uid) || !idPattern.test(expenseId) || !value || typeof value !== 'object') throw new ExpenseError(400, 'invalid_expense');
  const body = value as Record<string, unknown>;
  const expectedRevision = body['expectedRevision'];
  if (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 0) throw new ExpenseError(400, 'invalid_revision');
  const expense = method === 'PATCH' ? parseExpense({ ...body, idempotencyKey: expenseId }) : undefined;
  const allocations = expense ? splitAmount(expense.amountMinor, expense.splitMode) : [];
  const members = expense ? [...new Set([uid, ...expense.payments.map(item => item.userId), ...allocations.map(item => item.userId)])] : [uid];
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const begin = await json(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new ExpenseError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  const pendingReceipts: { name: string; publicId: string }[] = [];
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      return response.status === 404 ? null : await json(response);
    };
    const group = await read(`groups/${groupId}`);
    const groupFields = group?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    if (groupFields?.['status']?.stringValue !== 'active') throw new ExpenseError(403, 'group_inactive');
    if (expense && (groupFields['currencyCode']?.stringValue ?? groupFields['currency']?.stringValue) !== expense.currency) throw new ExpenseError(400, 'currency_mismatch');
    for (const memberId of members) {
      const record = await read(`groups/${groupId}/members/${memberId}`);
      const fields = record?.['fields'] as Record<string, { stringValue?: string }> | undefined;
      if (fields?.['status']?.stringValue !== 'active') throw new ExpenseError(403, 'member_inactive');
    }
    const stored = await read(`groups/${groupId}/expenses/${expenseId}`);
    const fields = stored?.['fields'] as Record<string, { stringValue?: string; integerValue?: string; booleanValue?: boolean }> | undefined;
    if (!fields || fields['createdBy']?.stringValue !== uid) throw new ExpenseError(403, 'author_required');
    if (fields['deleted']?.booleanValue === true && method !== 'DELETE') throw new ExpenseError(409, 'expense_deleted');
    const revision = Number(fields['revision']?.integerValue ?? 0);
    if (revision !== expectedRevision && fields['deleted']?.booleanValue !== true) throw new ExpenseError(409, 'revision_conflict');
    const nextRevision = revision + 1;
    const now = new Date().toISOString();
    let changes: Record<string, unknown>;
    if (expense) {
      let category: CategoryDefinition = categoryById(expense.categoryId);
      if (expense.categoryId === fields['categoryId']?.stringValue) {
        category = { id: expense.categoryId, label: fields['categoryLabel']?.stringValue ?? category.label, icon: fields['categoryIcon']?.stringValue ?? category.icon, color: (fields['categoryColor']?.stringValue ?? category.color) as CategoryColor };
      } else if (isCustomCategoryId(expense.categoryId)) {
        const categoryDoc = await read(`groups/${groupId}/categories/${expense.categoryId}`);
        const categoryFields = categoryDoc?.['fields'] as Record<string, { stringValue?: string }> | undefined;
        const icon = categoryIcons.find(item => item.id === categoryFields?.['iconId']?.stringValue);
        if (categoryFields?.['status']?.stringValue !== 'active' || !categoryFields['name']?.stringValue || !icon || !categoryFields['color']?.stringValue) throw new ExpenseError(403, 'category_unavailable');
        category = { id: expense.categoryId, label: categoryFields['name'].stringValue, icon: icon.glyph, color: categoryFields['color'].stringValue as CategoryColor };
      }
      validateExpense(expense.amountMinor, expense.payments, allocations, new Set(members));
      changes = { description: string(expense.description), categoryId: string(expense.categoryId), categoryLabel: string(category.label), categoryIcon: string(category.icon), categoryColor: string(category.color), date: string(expense.date), amountMinor: integer(expense.amountMinor), payments: amountEntries(expense.payments), allocations: amountEntries(allocations), splitSnapshotJson: string(JSON.stringify(expense.splitMode)), revision: integer(nextRevision), updatedAt: { timestampValue: now } };
    } else {
      changes = { deleted: { booleanValue: true }, revision: integer(nextRevision), updatedAt: { timestampValue: now }, deletedAt: { timestampValue: now } };
    }
    const action = method === 'PATCH' ? 'expense_updated' : 'expense_deleted';
    const writes: unknown[] = [
      { update: { name: `${root}/groups/${groupId}/expenses/${expenseId}`, fields: changes }, updateMask: { fieldPaths: Object.keys(changes) } },
      { update: { name: `${root}/groups/${groupId}/activity/${expenseId}_${method === 'PATCH' ? 'edit' : 'delete'}_${nextRevision}`, fields: { actorId: string(uid), action: string(action), expenseId: string(expenseId), at: { timestampValue: now } } }, currentDocument: { exists: false } },
    ];
    if (method === 'DELETE') {
      const listUrl = new URL(`https://firestore.googleapis.com/v1/${root}/groups/${groupId}/expenses/${expenseId}/attachments`);
      listUrl.searchParams.set('transaction', transaction);
      listUrl.searchParams.set('pageSize', '51');
      const listed = await json(await transport(listUrl, { headers }));
      const documents = listed['documents'];
      if (listed['nextPageToken'] || (Array.isArray(documents) && documents.length > 50)) throw new ExpenseError(409, 'too_many_receipts');
      if (documents !== undefined && !Array.isArray(documents)) throw new ExpenseError(503, 'invalid_receipts');
      for (const document of (documents ?? []) as Record<string, unknown>[]) {
        const name = document['name'];
        const meta = document['fields'] as Record<string, { stringValue?: string; booleanValue?: boolean }> | undefined;
        if (typeof name !== 'string' || !name.startsWith(`${root}/groups/${groupId}/expenses/${expenseId}/attachments/`) || !meta) throw new ExpenseError(503, 'invalid_receipts');
        if (meta['status']?.stringValue !== 'active' && meta['cleanupPending']?.booleanValue !== true) continue;
        const attachmentId = name.slice(name.lastIndexOf('/') + 1);
        const publicId = meta['publicId']?.stringValue;
        if (!idPattern.test(attachmentId) || publicId !== `ourfinance-test/${groupId}/${expenseId}/${attachmentId}` || meta['type']?.stringValue !== 'authenticated') throw new ExpenseError(503, 'invalid_receipts');
        pendingReceipts.push({ name, publicId });
        if (meta['status']?.stringValue === 'active') writes.push({ update: { name, fields: { status: string('deleted'), deletedAt: { timestampValue: now }, cleanupPending: { booleanValue: true } } }, updateMask: { fieldPaths: ['status', 'deletedAt', 'cleanupPending'] } });
      }
      if (pendingReceipts.length && (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)) throw new ExpenseError(503, 'media_cleanup_unavailable');
      if (fields['deleted']?.booleanValue === true) {
        if (!pendingReceipts.length) throw new ExpenseError(409, 'expense_deleted');
        await json(await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }));
        committed = true;
        await cleanupReceipts(pendingReceipts, env as ExpenseEnv & CloudinaryEnv, headers, transport);
        return;
      }
    }
    await json(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
    committed = true;
    if (pendingReceipts.length) await cleanupReceipts(pendingReceipts, env as ExpenseEnv & CloudinaryEnv, headers, transport);
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}

async function cleanupReceipts(receipts: readonly { name: string; publicId: string }[], env: ExpenseEnv & CloudinaryEnv, headers: Record<string, string>, transport: typeof fetch): Promise<void> {
  for (const receipt of receipts) {
    try {
      await destroyAuthenticated(receipt.publicId, env, transport);
      const url = `https://firestore.googleapis.com/v1/${receipt.name}?updateMask.fieldPaths=cleanupPending`;
      await json(await transport(url, { method: 'PATCH', headers, body: JSON.stringify({ fields: { cleanupPending: { booleanValue: false } } }) }));
    } catch { throw new ExpenseError(503, 'media_cleanup_failed'); }
  }
}
