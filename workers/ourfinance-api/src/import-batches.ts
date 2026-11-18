import { unavailableCode } from './provider-quota';
import { serviceAccessToken } from './service-account';

export interface ImportEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export class ImportError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
interface ImportRowBase {
  sourceId: string;
  date: string;
  description: string;
  currency: string;
}
interface LegacyImportRow extends ImportRowBase {
  amountMinor: number;
  netImpactsMinor: Record<string, number>;
}
interface ExactImportRow extends ImportRowBase {
  sourceCostExact: string;
  sourcePrecision: number;
  netImpactsExact: Record<string, string>;
  sourceCategory: string;
  sourceOccurrence: number;
}
type ImportRow = LegacyImportRow | ExactImportRow;
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const exactDecimal = /^-?\d{1,30}(?:\.\d{1,12})?$/;
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const string = (stringValue: string) => ({ stringValue });
const integer = (value: number) => ({ integerValue: String(value) });
function canonicalDecimal(value: string): string {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const normalized = `${BigInt(whole)}${fraction.replace(/0+$/, '') ? `.${fraction.replace(/0+$/, '')}` : ''}`;
  return normalized === '0' ? '0' : `${negative ? '-' : ''}${normalized}`;
}
async function nativeSourceId(row: ExactImportRow): Promise<string> {
  // The CSV has no trustworthy transaction ID. Duplicate prevention is conservative
  // within a target group and deliberately independent of a user-entered alias.
  return `native_${await sha256(JSON.stringify([
    row.date, row.description, row.sourceCategory, row.currency,
    canonicalDecimal(row.sourceCostExact), row.sourceOccurrence,
  ]))}`;
}
function exactUnits(value: string, precision: number): bigint {
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  if (fraction.length > precision) throw new ImportError(400, 'invalid_exact_amount');
  const units = BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, '0') || '0');
  return value.startsWith('-') ? -units : units;
}
const fields = (doc: Record<string, unknown> | null) => doc?.['fields'] as Record<string, { stringValue?: string; arrayValue?: { values?: { stringValue?: string }[] } }> | undefined;
const field = (doc: Record<string, unknown> | null, key: string) => fields(doc)?.[key]?.stringValue;

export function parseImportBatch(value: unknown, groupId: string): { batchId: string; rows: ImportRow[]; memberIds: string[] } {
  if (!idPattern.test(groupId) || !value || typeof value !== 'object') throw new ImportError(400, 'invalid_import');
  const input = value as Record<string, unknown>;
  if (typeof input['batchId'] !== 'string' || !uuidPattern.test(input['batchId']) || !Array.isArray(input['records']) || input['records'].length < 1 || input['records'].length > 10) throw new ImportError(400, 'invalid_import');
  const rows: ImportRow[] = [];
  const sourceIds = new Set<string>();
  const memberIds = new Set<string>();
  for (const raw of input['records']) {
    if (!raw || typeof raw !== 'object') throw new ImportError(400, 'invalid_record');
    const row = raw as Record<string, unknown>;
    const date = row['date'];
    const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    if (typeof row['sourceId'] !== 'string' || !row['sourceId'] || row['sourceId'].length > 128 || sourceIds.has(row['sourceId']) ||
        typeof row['description'] !== 'string' || !row['description'].trim() || row['description'].length > 160 ||
        !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date ||
        typeof row['currency'] !== 'string' || !Intl.supportedValuesOf('currency').includes(row['currency'])) throw new ImportError(400, 'invalid_record');
    const base: ImportRowBase = { sourceId: row['sourceId'], date, description: row['description'].trim(), currency: row['currency'] };
    if ('sourceCostExact' in row || 'netImpactsExact' in row || 'sourcePrecision' in row) {
      const precision = row['sourcePrecision'];
      const impacts = row['netImpactsExact'];
      if ('amountMinor' in row || 'netImpactsMinor' in row || typeof row['sourceCostExact'] !== 'string' || !exactDecimal.test(row['sourceCostExact']) ||
          !Number.isInteger(precision) || (precision as number) < 0 || (precision as number) > 12 ||
          typeof row['sourceCategory'] !== 'string' || row['sourceCategory'].length > 120 ||
          !Number.isSafeInteger(row['sourceOccurrence']) || (row['sourceOccurrence'] as number) < 0 ||
          !impacts || typeof impacts !== 'object' || Array.isArray(impacts)) throw new ImportError(400, 'invalid_exact_amount');
      const entries = Object.entries(impacts);
      if (!entries.length || entries.length > 20 || entries.some(([id, amount]) => !idPattern.test(id) || typeof amount !== 'string' || !exactDecimal.test(amount))) throw new ImportError(400, 'invalid_impacts');
      const digits = precision as number;
      if (exactUnits(row['sourceCostExact'], digits) <= 0n || entries.reduce((sum, [, amount]) => sum + exactUnits(amount as string, digits), 0n) !== 0n) throw new ImportError(400, 'unbalanced_impacts');
      if (Math.max((row['sourceCostExact'].split('.')[1] ?? '').length, ...entries.map(([, amount]) => ((amount as string).split('.')[1] ?? '').length)) !== digits) throw new ImportError(400, 'invalid_exact_amount');
      rows.push({ ...base, sourceCostExact: row['sourceCostExact'], sourcePrecision: digits, netImpactsExact: impacts as Record<string, string>,
        sourceCategory: row['sourceCategory'].trim(), sourceOccurrence: row['sourceOccurrence'] as number });
      for (const [id] of entries) memberIds.add(id);
    } else {
      const impacts = row['netImpactsMinor'];
      if (!Number.isSafeInteger(row['amountMinor']) || (row['amountMinor'] as number) <= 0 || !impacts || typeof impacts !== 'object' || Array.isArray(impacts)) throw new ImportError(400, 'invalid_record');
      const entries = Object.entries(impacts);
      if (!entries.length || entries.length > 20 || entries.some(([id, amount]) => !idPattern.test(id) || !Number.isSafeInteger(amount))) throw new ImportError(400, 'invalid_impacts');
      if (entries.reduce((sum, [, amount]) => sum + BigInt(amount as number), 0n) !== 0n) throw new ImportError(400, 'unbalanced_impacts');
      rows.push({ ...base, amountMinor: row['amountMinor'] as number, netImpactsMinor: impacts as Record<string, number> });
      for (const [id] of entries) memberIds.add(id);
    }
    sourceIds.add(row['sourceId']);
  }
  return { batchId: input['batchId'], rows, memberIds: [...memberIds] };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new ImportError(response.status === 409 ? 409 : 503, response.status === 409 ? 'import_conflict' : unavailableCode(response, 'firestore_unavailable'));
  return await response.json() as Record<string, unknown>;
}
async function withTransaction<T>(env: ImportEnv, transport: typeof fetch, run: (context: { root: string; read: (path: string) => Promise<Record<string, unknown> | null>; commit: (writes: unknown[]) => Promise<void> }) => Promise<T>): Promise<T> {
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const accessToken = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new ImportError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      if (response.status === 404) return null;
      return await checked(response);
    };
    const commit = async (writes: unknown[]) => {
      await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
      committed = true;
    };
    return await run({ root, read, commit });
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}

/** Store exact net impacts as historical facts, never inferred payer/owed allocations. */
export async function createImportBatch(value: unknown, uid: string, groupId: string, env: ImportEnv, transport: typeof fetch = fetch): Promise<{ batchId: string; recordCount: number }> {
  if (!idPattern.test(uid)) throw new ImportError(400, 'invalid_user');
  const input = parseImportBatch(value, groupId);
  for (const row of input.rows) {
    if ('sourceCostExact' in row && row.sourceId !== await nativeSourceId(row)) throw new ImportError(400, 'invalid_native_source');
  }
  const ids = await Promise.all(input.rows.map(row => sha256(row.sourceId)));
  return withTransaction(env, transport, async ({ root, read, commit }) => {
    const group = await read(`groups/${groupId}`);
    if (field(group, 'status') !== 'active') throw new ImportError(403, 'group_inactive');
    const currencyCode = field(group, 'currencyCode') ?? field(group, 'currency');
    if (input.rows.some(row => row.currency !== currencyCode)) throw new ImportError(400, 'currency_mismatch');
    const author = await read(`groups/${groupId}/members/${uid}`);
    if (field(author, 'status') !== 'active' || field(author, 'role') !== 'owner') throw new ImportError(403, 'owner_required');
    for (const memberId of new Set([uid, ...input.memberIds])) {
      if (field(await read(`groups/${groupId}/members/${memberId}`), 'status') !== 'active') throw new ImportError(403, 'member_inactive');
    }
    for (const id of ids) if (await read(`groups/${groupId}/importedRecords/${id}`)) throw new ImportError(409, 'duplicate_source');
    const now = new Date().toISOString();
    const create = (path: string, data: Record<string, unknown>) => ({ update: { name: `${root}/${path}`, fields: data }, currentDocument: { exists: false } });
    const writes: unknown[] = input.rows.map((row, index) => create(`groups/${groupId}/importedRecords/${ids[index]}`, {
      sourceId: string(row.sourceId), batchId: string(input.batchId), date: string(row.date), description: string(row.description), currency: string(row.currency),
      splitStatus: string('undetermined'), status: string('active'), createdAt: { timestampValue: now },
      ...('sourceCostExact' in row
        ? { sourceCostExact: string(row.sourceCostExact), sourcePrecision: integer(row.sourcePrecision), sourceCategory: string(row.sourceCategory),
            sourceOccurrence: integer(row.sourceOccurrence), netImpactsExact: { mapValue: { fields: Object.fromEntries(Object.entries(row.netImpactsExact).map(([id, amount]) => [id, string(amount)])) } } }
        : { amountMinor: integer(row.amountMinor), netImpactsMinor: { mapValue: { fields: Object.fromEntries(Object.entries(row.netImpactsMinor).map(([id, amount]) => [id, integer(amount)])) } } }),
    }));
    writes.push(create(`users/${uid}/importBatches/${input.batchId}`, {
      groupId: string(groupId), status: string('active'), source: string('splitwise_csv'), recordIds: { arrayValue: { values: ids.map(string) } }, createdAt: { timestampValue: now },
    }));
    writes.push(create(`groups/${groupId}/activity/import_${input.batchId}`, { actorId: string(uid), action: string('import_created'), batchId: string(input.batchId), at: { timestampValue: now } }));
    if (!fields(group)?.['currencyLockedAt']) writes.push({ update: { name: `${root}/groups/${groupId}`, fields: { currencyLockedAt: { timestampValue: now } } }, updateMask: { fieldPaths: ['currencyLockedAt'] } });
    await commit(writes);
    return { batchId: input.batchId, recordCount: input.rows.length };
  });
}

/** Undo keeps audit documents but removes every imported record from active accounting. */
export async function undoImportBatch(batchId: string, uid: string, groupId: string, env: ImportEnv, transport: typeof fetch = fetch): Promise<void> {
  if (!uuidPattern.test(batchId) || !idPattern.test(uid) || !idPattern.test(groupId)) throw new ImportError(400, 'invalid_import');
  await withTransaction(env, transport, async ({ root, read, commit }) => {
    const group = await read(`groups/${groupId}`);
    const author = await read(`groups/${groupId}/members/${uid}`);
    if (field(group, 'status') !== 'active' || field(author, 'status') !== 'active' || field(author, 'role') !== 'owner') throw new ImportError(403, 'owner_required');
    const batch = await read(`users/${uid}/importBatches/${batchId}`);
    if (field(batch, 'groupId') !== groupId || field(batch, 'status') !== 'active') throw new ImportError(403, 'batch_unavailable');
    const ids = fields(batch)?.['recordIds']?.arrayValue?.values?.map(item => item.stringValue) ?? [];
    if (!ids.length || ids.length > 10 || ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id))) throw new ImportError(503, 'batch_invalid');
    for (const id of ids) {
      const record = await read(`groups/${groupId}/importedRecords/${id}`);
      if (field(record, 'batchId') !== batchId || field(record, 'status') !== 'active') throw new ImportError(409, 'record_changed');
    }
    const now = new Date().toISOString();
    const update = (path: string, data: Record<string, unknown>) => ({ update: { name: `${root}/${path}`, fields: data }, updateMask: { fieldPaths: Object.keys(data) } });
    const writes: unknown[] = ids.map(id => update(`groups/${groupId}/importedRecords/${id}`, { status: string('undone'), undoneAt: { timestampValue: now } }));
    writes.push(update(`users/${uid}/importBatches/${batchId}`, { status: string('undone'), undoneAt: { timestampValue: now } }));
    writes.push({ update: { name: `${root}/groups/${groupId}/activity/import_undo_${batchId}`, fields: { actorId: string(uid), action: string('import_undone'), batchId: string(batchId), at: { timestampValue: now } } }, currentDocument: { exists: false } });
    await commit(writes);
  });
}
