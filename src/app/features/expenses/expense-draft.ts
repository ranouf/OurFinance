import { minorDigits } from '../../shared/utils/currency';
import { splitAmount, validateExpense, type Allocation, type SplitMode } from '../../shared/utils/split-engine';

export type ModeKind = SplitMode['kind'];
export interface SplitRow { userId: string; selected: boolean; value: string; }
export interface ExpenseDraft {
  description: string; amount: string; currency: string; date: string;
  payerId: string; kind: ModeKind; rows: SplitRow[];
}

/** Decimal input is converted by string operations, never floating point multiplication. */
export function parseMinor(text: string, currency: string, signed = false): number {
  const digits = minorDigits(currency);
  const match = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(text.trim());
  if (!match || (!signed && match[1]) || (match[3]?.length ?? 0) > digits) throw new Error('Montant invalide pour cette devise');
  const value = BigInt(match[2]) * 10n ** BigInt(digits) + BigInt((match[3] ?? '').padEnd(digits, '0') || '0');
  const result = Number(match[1] ? -value : value);
  if (!Number.isSafeInteger(result)) throw new Error('Montant trop élevé');
  return result;
}

export function prepareExpense(draft: ExpenseDraft, activeIds: ReadonlySet<string>): { amountMinor: number; payments: Allocation[]; splitMode: SplitMode; allocations: Allocation[] } {
  const amountMinor = parseMinor(draft.amount, draft.currency);
  if (amountMinor <= 0 || !activeIds.has(draft.payerId)) throw new Error('Montant ou payeur invalide');
  const rows = draft.rows.filter(row => row.selected);
  if (!rows.length || rows.some(row => !activeIds.has(row.userId)) || new Set(rows.map(row => row.userId)).size !== rows.length) throw new Error('Choisissez des membres actifs');
  const number = (value: string) => {
    if (!/^\d+$/.test(value.trim())) throw new Error('Entrez un entier positif');
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error('Valeur trop élevée');
    return parsed;
  };
  let splitMode: SplitMode;
  switch (draft.kind) {
    case 'equal': splitMode = { kind: 'equal', users: rows.map(row => row.userId) }; break;
    case 'exact': splitMode = { kind: 'exact', amounts: rows.map(row => ({ userId: row.userId, amountMinor: parseMinor(row.value, draft.currency) })) }; break;
    case 'percentage': splitMode = { kind: 'percentage', weightsBasisPoints: rows.map(row => ({ userId: row.userId, value: parsePercentBasisPoints(row.value) })) }; break;
    case 'shares': splitMode = { kind: 'shares', weights: rows.map(row => ({ userId: row.userId, value: number(row.value) })) }; break;
    case 'adjustment': splitMode = { kind: 'adjustment', adjustments: rows.map(row => ({ userId: row.userId, amountMinor: parseMinor(row.value, draft.currency, true) })) }; break;
  }
  const allocations = splitAmount(amountMinor, splitMode);
  const payments = [{ userId: draft.payerId, amountMinor }];
  validateExpense(amountMinor, payments, allocations, activeIds);
  return { amountMinor, payments, splitMode, allocations };
}

export function parsePercentBasisPoints(text: string): number {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) throw new Error('Pourcentage invalide');
  const value = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(value) || value > 10000) throw new Error('Pourcentage invalide');
  return value;
}
