import { unavailableCode } from './provider-quota';
import { serviceAccessToken } from './service-account';

export interface GroupCurrencyEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export class GroupCurrencyError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const field = (doc: Record<string, unknown> | null, key: string) =>
  ((doc?.['fields'] as Record<string, { stringValue?: string; timestampValue?: string }> | undefined)?.[key]);

async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new GroupCurrencyError(response.status === 409 ? 409 : 503, response.status === 409 ? 'transaction_conflict' : unavailableCode(response, 'firestore_unavailable'));
  return await response.json() as Record<string, unknown>;
}

/** Change currency only for an active group that has never recorded an operation. */
export async function changeGroupCurrency(value: unknown, uid: string, groupId: string, env: GroupCurrencyEnv, transport: typeof fetch = fetch): Promise<void> {
  const currencyCode = (value as Record<string, unknown> | null)?.['currencyCode'];
  if (!idPattern.test(uid) || !idPattern.test(groupId) || typeof currencyCode !== 'string' || !/^[A-Z]{3}$/.test(currencyCode) || !Intl.supportedValuesOf('currency').includes(currencyCode)) {
    throw new GroupCurrencyError(400, 'invalid_currency');
  }
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new GroupCurrencyError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      return response.status === 404 ? null : await checked(response);
    };
    const group = await read(`groups/${groupId}`);
    const member = await read(`groups/${groupId}/members/${uid}`);
    if (field(group, 'status')?.stringValue !== 'active' || field(member, 'status')?.stringValue !== 'active' || field(member, 'role')?.stringValue !== 'owner') throw new GroupCurrencyError(403, 'owner_required');
    if (field(group, 'currencyLockedAt')) throw new GroupCurrencyError(403, 'currency_locked');
    // Older groups may predate currencyLockedAt. Retain archived and undone history.
    for (const collection of ['expenses', 'settlements', 'importedRecords']) {
      const listUrl = new URL(`https://firestore.googleapis.com/v1/${root}/groups/${groupId}/${collection}`);
      listUrl.searchParams.set('pageSize', '1');
      listUrl.searchParams.set('transaction', transaction);
      const result = await checked(await transport(listUrl, { headers }));
      if (Array.isArray(result['documents']) && result['documents'].length) throw new GroupCurrencyError(403, 'currency_locked');
    }
    if ((field(group, 'currencyCode')?.stringValue ?? field(group, 'currency')?.stringValue) === currencyCode) {
      return;
    }
    const writes = [{ update: { name: `${root}/groups/${groupId}`, fields: { currencyCode: { stringValue: currencyCode }, currency: { stringValue: currencyCode } } }, updateMask: { fieldPaths: ['currencyCode', 'currency'] } }];
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
    committed = true;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}
