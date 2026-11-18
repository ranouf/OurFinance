import { calculateBalances, type ExpenseLedgerEntry, type SettlementLedgerEntry } from '../../shared/utils/ledger';
import { chartData, type ChartData } from './chart-data';
import type { SelectionUnit } from './period-range';

export interface StatisticsTotals {
  readonly currency: string;
  readonly spentMinor: bigint;
  readonly settledMinor: bigint;
  readonly myPaidMinor: bigint;
  readonly myOwedMinor: bigint;
  readonly myBalanceMinor: bigint;
}

/** Derives one group's period view from the source ledger, without mixing currencies. */
export class StatisticsService {
  summarize(groupId: string, currency: string, userId: string,
    expenses: readonly ExpenseLedgerEntry[], settlements: readonly SettlementLedgerEntry[],
    start: string, end: string, unit: SelectionUnit): { totals: StatisticsTotals; chart: ChartData } | undefined {
    const groupExpenses = expenses.filter(row => row.groupId === groupId && row.currency === currency);
    const groupSettlements = settlements.filter(row => row.groupId === groupId && row.currency === currency);
    const inRange = (date: string) => date >= start && date <= end;
    if (!groupExpenses.some(row => !row.deleted && inRange(row.date)) &&
        !groupSettlements.some(row => !row.deleted && inRange(row.date))) return undefined;
    const rows = calculateBalances(groupExpenses, groupSettlements, start, end);
    const mine = rows.find(row => row.userId === userId);
    return {
      totals: {
        currency,
        spentMinor: rows.reduce((sum, row) => sum + row.paidMinor, 0n),
        settledMinor: rows.reduce((sum, row) => sum + row.settlementsSentMinor, 0n),
        myPaidMinor: mine?.paidMinor ?? 0n,
        myOwedMinor: mine?.owedMinor ?? 0n,
        myBalanceMinor: mine?.balanceMinor ?? 0n,
      },
      chart: chartData(groupExpenses, groupSettlements, currency, start, end, unit),
    };
  }
}
