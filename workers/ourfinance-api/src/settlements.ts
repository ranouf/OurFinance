import { serviceAccessToken } from './service-account';

export interface SettlementEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export interface SettlementInput {
  readonly idempotencyKey: string;
  readonly date: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly fromUserId: string;
  readonly toUserId: string;
}
export class SettlementError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const string = (stringValue: string) => ({ stringValue });

export function parseSettlement(value: unknown, uid: string): SettlementInput {
  if (!value || typeof value !== 'object' || !idPattern.test(uid)) throw new SettlementError(400, 'invalid_settlement');
  const input = value as Record<string, unknown>;
  const date = input['date'];
  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  if (typeof input['idempotencyKey'] !== 'string' || !uuidPattern.test(input['idempotencyKey']) ||
      typeof input['currency'] !== 'string' || !Intl.supportedValuesOf('currency').includes(input['currency']) ||
      !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date ||
      !Number.isSafeInteger(input['amountMinor']) || (input['amountMinor'] as number) <= 0 ||
      input['fromUserId'] !== uid || typeof input['toUserId'] !== 'string' || !idPattern.test(input['toUserId']) || input['toUserId'] === uid) {
    throw new SettlementError(400, 'invalid_settlement');
  }
  return { idempotencyKey: input['idempotencyKey'], date, currency: input['currency'], amountMinor: input['amountMinor'] as number, fromUserId: uid, toUserId: input['toUserId'] };
}

async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new SettlementError(response.status === 409 ? 409 : 503, response.status === 409 ? 'transaction_conflict' : 'firestore_unavailable');
  return await response.json() as Record<string, unknown>;
}

/** A sender can record only their own same-currency transfer to another active group member. */
export async function createSettlement(value: unknown, uid: string, groupId: string, env: SettlementEnv, transport: typeof fetch = fetch): Promise<string> {
  if (!idPattern.test(groupId)) throw new SettlementError(400, 'invalid_group');
  const input = parseSettlement(value, uid);
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const accessToken = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new SettlementError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      if (response.status === 404) return null;
      return await checked(response);
    };
    const group = await read(`groups/${groupId}`);
    const status = (document: Record<string, unknown> | null) => ((document?.['fields'] as Record<string, { stringValue?: string }> | undefined)?.['status']?.stringValue);
    if (status(group) !== 'active') throw new SettlementError(403, 'group_inactive');
    const groupFields = group?.['fields'] as Record<string, { stringValue?: string }> | undefined;
    if ((groupFields?.['currencyCode']?.stringValue ?? groupFields?.['currency']?.stringValue) !== input.currency) throw new SettlementError(400, 'currency_mismatch');
    for (const memberId of [uid, input.toUserId]) {
      if (status(await read(`groups/${groupId}/members/${memberId}`)) !== 'active') throw new SettlementError(403, 'member_inactive');
    }
    const now = new Date().toISOString();
    const settlementId = input.idempotencyKey;
    const create = (path: string, fields: Record<string, unknown>) => ({ update: { name: `${root}/${path}`, fields }, currentDocument: { exists: false } });
    const writes = [
      create(`groups/${groupId}/settlements/${settlementId}`, {
        date: string(input.date), currency: string(input.currency), amountMinor: { integerValue: String(input.amountMinor) }, fromUserId: string(uid), toUserId: string(input.toUserId),
        status: string('recorded'), createdBy: string(uid), createdAt: { timestampValue: now }, deleted: { booleanValue: false },
      }),
      create(`groups/${groupId}/activity/settlement_${settlementId}`, { actorId: string(uid), action: string('settlement_recorded'), settlementId: string(settlementId), at: { timestampValue: now } }),
    ];
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
    committed = true;
    return settlementId;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original denial or service error. */ }
    }
  }
}
