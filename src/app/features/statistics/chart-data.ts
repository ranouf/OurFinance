import { categoryById } from '../../shared/utils/categories';
import { calculateBalances, type ExpenseLedgerEntry, type LedgerTotal, type SettlementLedgerEntry } from '../../shared/utils/ledger';
import type { SelectionUnit } from './period-range';

export interface CategorySlice {
  readonly id: string;
  readonly label: string;
  readonly amountMinor: bigint;
}

export interface TimePoint {
  readonly period: string;
  readonly amountMinor: bigint;
}

export interface ChartData {
  readonly categories: readonly CategorySlice[];
  readonly members: readonly LedgerTotal[];
  readonly timeline: readonly TimePoint[];
  readonly totalMinor: bigint;
}

export function chartData(
  expenses: readonly ExpenseLedgerEntry[],
  settlements: readonly SettlementLedgerEntry[],
  currency: string,
  start: string,
  end: string,
  unit: SelectionUnit,
): ChartData {
  const inRange = (date: string) => date >= start && date <= end;
  const relevant = expenses.filter(expense => !expense.deleted && expense.currency === currency && inRange(expense.date));
  const byCategory = new Map<string, CategorySlice>();
  const byTime = new Map<string, bigint>();
  let totalMinor = 0n;
  for (const expense of relevant) {
    const amount = BigInt(expense.amountMinor);
    totalMinor += amount;
    const id = expense.categoryId ?? 'other';
    const current = byCategory.get(id);
    byCategory.set(id, { id, label: expense.categoryLabel ?? categoryById(id).label, amountMinor: (current?.amountMinor ?? 0n) + amount });
    const period = unit === 'years' ? expense.date.slice(0, 4) : unit === 'months' ? expense.date.slice(0, 7) : expense.date;
    byTime.set(period, (byTime.get(period) ?? 0n) + amount);
  }
  const members = calculateBalances(relevant, settlements.filter(settlement => !settlement.deleted && settlement.currency === currency && inRange(settlement.date)));
  return {
    categories: [...byCategory.values()].sort((a, b) => a.amountMinor === b.amountMinor ? a.label.localeCompare(b.label) : a.amountMinor > b.amountMinor ? -1 : 1),
    members,
    timeline: [...byTime].sort(([a], [b]) => a.localeCompare(b)).map(([period, amountMinor]) => ({ period, amountMinor })),
    totalMinor,
  };
}
