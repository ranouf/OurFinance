import { calculateBalances, type ExpenseLedgerEntry, type SettlementLedgerEntry } from '../../shared/utils/ledger';

export interface DashboardMetrics {
  readonly balanceMinor: bigint;
  readonly groupSpentMinor: bigint;
  readonly monthlySpentMinor: bigint;
  readonly monthlyPaidMinor: bigint;
  readonly settlementTotalMinor: bigint;
  readonly memberBalances: readonly { userId: string; balanceMinor: bigint }[];
  readonly categories: readonly { id: string; label?: string; amountMinor: bigint }[];
}

/** Totals for the selected group only. Historical imports never enter active balances. */
export function dashboardMetrics(
  expenses: readonly ExpenseLedgerEntry[], settlements: readonly SettlementLedgerEntry[],
  groupId: string, currency: string, userId: string, month: string,
): DashboardMetrics {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Période du dashboard invalide');
  const groupExpenses = expenses.filter(row => row.groupId === groupId && row.currency === currency && !row.deleted);
  const groupSettlements = settlements.filter(row => row.groupId === groupId && row.currency === currency && !row.deleted);
  const memberBalances = calculateBalances(groupExpenses, groupSettlements)
    .map(row => ({ userId: row.userId, balanceMinor: row.balanceMinor }));
  const balanceMinor = memberBalances
    .find(row => row.userId === userId)?.balanceMinor ?? 0n;
  const monthly = groupExpenses.filter(row => row.date.startsWith(`${month}-`));
  const categoryTotals = new Map<string, { label?: string; amountMinor: bigint }>();
  for (const row of groupExpenses) {
    const id = row.categoryId?.trim() || 'other';
    const previous = categoryTotals.get(id);
    categoryTotals.set(id, { label: row.categoryLabel?.trim() || previous?.label,
      amountMinor: (previous?.amountMinor ?? 0n) + BigInt(row.amountMinor) });
  }
  return {
    balanceMinor,
    groupSpentMinor: groupExpenses.reduce((total, row) => total + BigInt(row.amountMinor), 0n),
    monthlySpentMinor: monthly.reduce((total, row) => total + BigInt(row.amountMinor), 0n),
    monthlyPaidMinor: monthly.reduce((total, row) => total + row.payments
      .filter(payment => payment.userId === userId)
      .reduce((paid, payment) => paid + BigInt(payment.amountMinor), 0n), 0n),
    settlementTotalMinor: groupSettlements.reduce((total, row) => total + BigInt(row.amountMinor), 0n),
    memberBalances,
    categories: [...categoryTotals].map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.amountMinor === b.amountMinor ? a.id.localeCompare(b.id) : a.amountMinor > b.amountMinor ? -1 : 1),
  };
}
