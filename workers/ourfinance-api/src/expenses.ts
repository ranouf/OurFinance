import { splitAmount, validateExpense, type Allocation, type SplitMode } from '../../../src/app/shared/utils/split-engine';
import { categories, categoryById, categoryIcons, isCustomCategoryId, type CategoryColor, type CategoryDefinition } from '../../../src/app/shared/utils/categories';
import { serviceAccessToken } from './service-account';

export interface ExpenseEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
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
  if (!response.ok) throw new ExpenseError(response.status === 409 ? 409 : 503, response.status === 409 ? 'transaction_conflict' : 'firestore_unavailable');
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
      payments: amountEntries(expense.payments), allocations: amountEntries(allocations), splitSnapshotJson: string(JSON.stringify(expense.splitMode)), deleted: { booleanValue: false },
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
