import type { Allocation, SplitMode } from './split-engine';

export interface ExpenseFingerprintInput {
  readonly description: string;
  readonly categoryId: string;
  readonly currency: string;
  readonly date: string;
  readonly amountMinor: number;
  readonly payments: readonly Allocation[];
  readonly splitMode: SplitMode;
}

const sortedByUser = <T extends { readonly userId: string }>(entries: readonly T[]): T[] => [...entries].sort((a, b) => a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0);

/** The browser and Worker hash the same validated monetary operation. */
export async function expenseFingerprint(expense: ExpenseFingerprintInput, allocations: readonly Allocation[]): Promise<string> {
  const mode = expense.splitMode;
  const normalizedMode = mode.kind === 'equal' ? { kind: mode.kind, users: [...mode.users].sort() }
    : mode.kind === 'exact' ? { kind: mode.kind, amounts: sortedByUser(mode.amounts) }
    : mode.kind === 'percentage' ? { kind: mode.kind, weightsBasisPoints: sortedByUser(mode.weightsBasisPoints) }
    : mode.kind === 'shares' ? { kind: mode.kind, weights: sortedByUser(mode.weights) }
    : { kind: mode.kind, adjustments: sortedByUser(mode.adjustments) };
  const body = JSON.stringify({
    description: expense.description, categoryId: expense.categoryId, currency: expense.currency, date: expense.date,
    amountMinor: expense.amountMinor, payments: sortedByUser(expense.payments), allocations: sortedByUser(allocations), splitMode: normalizedMode,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
