import { convertMinor, type ExchangeRateSnapshot } from '../../../src/app/shared/utils/exchange-rate';
import { serviceAccessToken } from './service-account';

export interface FxSettlementEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export interface FxSettlementInput {
  readonly idempotencyKey: string;
  readonly date: string;
  readonly debtCurrency: string;
  readonly debtAmountMinor: number;
  readonly paymentCurrency: string;
  readonly paymentAmountMinor: number;
  readonly rate: string;
  readonly rateDate: string;
  readonly fromUserId: string;
  readonly toUserId: string;
}
export class FxSettlementError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const string = (stringValue: string) => ({ stringValue });

export function parseFxSettlement(value: unknown, uid: string): FxSettlementInput {
  if (!value || typeof value !== 'object' || !idPattern.test(uid)) throw new FxSettlementError(400, 'invalid_fx_settlement');
  const input = value as Record<string, unknown>;
  if (typeof input['idempotencyKey'] !== 'string' || !uuidPattern.test(input['idempotencyKey']) ||
      !validDate(input['date']) || !validDate(input['rateDate']) ||
      typeof input['debtCurrency'] !== 'string' || typeof input['paymentCurrency'] !== 'string' || typeof input['rate'] !== 'string' ||
      !Number.isSafeInteger(input['debtAmountMinor']) || (input['debtAmountMinor'] as number) <= 0 ||
      !Number.isSafeInteger(input['paymentAmountMinor']) || (input['paymentAmountMinor'] as number) <= 0 ||
      input['fromUserId'] !== uid || typeof input['toUserId'] !== 'string' || !idPattern.test(input['toUserId']) || input['toUserId'] === uid) {
    throw new FxSettlementError(400, 'invalid_fx_settlement');
  }
  const snapshot: ExchangeRateSnapshot = {
    sourceCurrency: input['debtCurrency'], targetCurrency: input['paymentCurrency'], rate: input['rate'], date: input['rateDate'] as string, origin: 'manual',
  };
  try { if (convertMinor(input['debtAmountMinor'] as number, snapshot) !== input['paymentAmountMinor']) throw new Error('Montants incohérents'); }
  catch { throw new FxSettlementError(400, 'invalid_fx_rate'); }
  return {
    idempotencyKey: input['idempotencyKey'], date: input['date'] as string, debtCurrency: input['debtCurrency'],
    debtAmountMinor: input['debtAmountMinor'] as number, paymentCurrency: input['paymentCurrency'],
    paymentAmountMinor: input['paymentAmountMinor'] as number, rate: input['rate'], rateDate: input['rateDate'] as string,
    fromUserId: uid, toUserId: input['toUserId'],
  };
}

async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new FxSettlementError(response.status === 409 ? 409 : 503, response.status === 409 ? 'fx_conflict' : 'firestore_unavailable');
  return await response.json() as Record<string, unknown>;
}

/** Clears a debt in its own currency; records actual payment currency separately. */
export async function createFxSettlement(value: unknown, uid: string, groupId: string, env: FxSettlementEnv, transport: typeof fetch = fetch): Promise<string> {
  if (!idPattern.test(groupId)) throw new FxSettlementError(400, 'invalid_group');
  const input = parseFxSettlement(value, uid);
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new FxSettlementError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      if (response.status === 404) return null;
      return await checked(response);
    };
    const status = (document: Record<string, unknown> | null) =>
      ((document?.['fields'] as Record<string, { stringValue?: string }> | undefined)?.['status']?.stringValue);
    if (status(await read(`groups/${groupId}`)) !== 'active') throw new FxSettlementError(403, 'group_inactive');
    for (const memberId of [uid, input.toUserId]) {
      if (status(await read(`groups/${groupId}/members/${memberId}`)) !== 'active') throw new FxSettlementError(403, 'member_inactive');
    }
    const now = new Date().toISOString();
    const create = (path: string, fields: Record<string, unknown>) => ({ update: { name: `${root}/${path}`, fields }, currentDocument: { exists: false } });
    const fxId = input.idempotencyKey;
    const writes = [
      create(`groups/${groupId}/fxSettlements/${fxId}`, {
        date: string(input.date), debtCurrency: string(input.debtCurrency), debtAmountMinor: { integerValue: String(input.debtAmountMinor) },
        paymentCurrency: string(input.paymentCurrency), paymentAmountMinor: { integerValue: String(input.paymentAmountMinor) },
        rate: string(input.rate), rateDate: string(input.rateDate), rateOrigin: string('manual'),
        fromUserId: string(uid), toUserId: string(input.toUserId), status: string('recorded'), deleted: { booleanValue: false },
        createdBy: string(uid), createdAt: { timestampValue: now },
      }),
      create(`groups/${groupId}/activity/fx_settlement_${fxId}`, {
        actorId: string(uid), action: string('fx_settlement_recorded'), fxSettlementId: string(fxId), at: { timestampValue: now },
      }),
    ];
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
    committed = true;
    return fxId;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}
