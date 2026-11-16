import { convertMinor } from '../../shared/utils/exchange-rate';
import { serializeGroupExportV1, type GroupExportV1 } from './export-v1';

export interface FxExportEntryV2 {
  readonly id: string;
  readonly date: string;
  readonly debtCurrency: string;
  readonly debtAmountMinor: number;
  readonly paymentCurrency: string;
  readonly paymentAmountMinor: number;
  readonly rate: string;
  readonly rateDate: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly status: 'recorded';
  readonly deleted: boolean;
}

/** Extends V1 without changing the interpretation of existing files. */
export interface GroupExportV2 extends Omit<GroupExportV1, 'version'> {
  readonly version: 2;
  readonly fxSettlements: readonly FxExportEntryV2[];
}

const validId = (value: string) => /^[A-Za-z0-9_-]{1,128}$/.test(value);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export function validateGroupExportV2(value: GroupExportV2): void {
  if (value.version !== 2 || !Array.isArray(value.fxSettlements)) throw new Error('Version ou remboursements FX invalides');
  serializeGroupExportV1({ ...value, version: 1 });
  const members = new Set(value.members.map(row => row.userId));
  const seen = new Set<string>();
  for (const row of value.fxSettlements) {
    if (!validId(row.id) || seen.has(row.id) || !validDate(row.date) || !validDate(row.rateDate) ||
        !members.has(row.fromUserId) || !members.has(row.toUserId) || row.fromUserId === row.toUserId ||
        row.status !== 'recorded' || typeof row.deleted !== 'boolean' ||
        !Number.isSafeInteger(row.debtAmountMinor) || row.debtAmountMinor <= 0 ||
        !Number.isSafeInteger(row.paymentAmountMinor) || row.paymentAmountMinor <= 0) throw new Error(`Remboursement FX ${row.id} invalide`);
    try {
      if (convertMinor(row.debtAmountMinor, { sourceCurrency: row.debtCurrency, targetCurrency: row.paymentCurrency,
        rate: row.rate, date: row.rateDate, origin: 'manual' }) !== row.paymentAmountMinor) throw new Error('Conversion incohérente');
    } catch { throw new Error(`Remboursement FX ${row.id} incohérent`); }
    seen.add(row.id);
  }
}

/** Emits an allowlisted, portable JSON document with no Firestore metadata. */
export function serializeGroupExportV2(value: GroupExportV2): string {
  validateGroupExportV2(value);
  const base = JSON.parse(serializeGroupExportV1({ ...value, version: 1 })) as GroupExportV1;
  return `${JSON.stringify({ ...base, version: 2, fxSettlements: value.fxSettlements.map(row => ({
    id: row.id, date: row.date, debtCurrency: row.debtCurrency, debtAmountMinor: row.debtAmountMinor,
    paymentCurrency: row.paymentCurrency, paymentAmountMinor: row.paymentAmountMinor, rate: row.rate, rateDate: row.rateDate,
    fromUserId: row.fromUserId, toUserId: row.toUserId, status: row.status, deleted: row.deleted,
  })) }, null, 2)}\n`;
}
