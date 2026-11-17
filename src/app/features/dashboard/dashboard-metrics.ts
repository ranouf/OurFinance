import { calculateBalances, type ExpenseLedgerEntry, type SettlementLedgerEntry } from '../../shared/utils/ledger';

export interface DashboardMetrics {
  readonly balanceMinor: bigint;
  readonly monthlySpentMinor: bigint;
  readonly monthlyPaidMinor: bigint;
}

/** Totals for the selected group only. Historical imports never enter active balances. */
export function dashboardMetrics(
  expenses: readonly ExpenseLedgerEntry[], settlements: readonly SettlementLedgerEntry[],
  groupId: string, currency: string, userId: string, month: string,
): DashboardMetrics {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Période du dashboard invalide');
  const groupExpenses = expenses.filter(row => row.groupId === groupId && row.currency === currency && !row.deleted);
  const groupSettlements = settlements.filter(row => row.groupId === groupId && row.currency === currency && !row.deleted);
  const balanceMinor = calculateBalances(groupExpenses, groupSettlements)
    .find(row => row.userId === userId)?.balanceMinor ?? 0n;
  const monthly = groupExpenses.filter(row => row.date.startsWith(`${month}-`));
  return {
    balanceMinor,
    monthlySpentMinor: monthly.reduce((total, row) => total + BigInt(row.amountMinor), 0n),
    monthlyPaidMinor: monthly.reduce((total, row) => total + row.payments
      .filter(payment => payment.userId === userId)
      .reduce((paid, payment) => paid + BigInt(payment.amountMinor), 0n), 0n),
  };
}
