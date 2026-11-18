import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { StatisticsService } from '../../src/app/features/statistics/statistics-service';
import { selectedRange } from '../../src/app/features/statistics/period-range';
import type { ExpenseLedgerEntry, SettlementLedgerEntry } from '../../src/app/shared/utils/ledger';

const expense = (groupId: string, currency: string, date: string, amountMinor: number): ExpenseLedgerEntry => ({
  groupId, currency, date, amountMinor, categoryId: 'food',
  payments: [{ userId: 'alice', amountMinor }],
  allocations: [{ userId: 'alice', amountMinor: Math.floor(amountMinor / 2) },
    { userId: 'bob', amountMinor: Math.ceil(amountMinor / 2) }],
});
const settlement = (groupId: string, currency: string, date: string, amountMinor: number): SettlementLedgerEntry => ({
  groupId, currency, date, amountMinor, fromUserId: 'bob', toUserId: 'alice',
});

test('statistics service isolates a group and currency with exact paid, owed and repayment totals', () => {
  const service = new StatisticsService();
  const expenses = [expense('a', 'CAD', '2026-11-01', 101), expense('b', 'CAD', '2026-11-01', 1000),
    expense('a', 'JPY', '2026-11-01', 500), { ...expense('a', 'CAD', '2026-11-02', 200), deleted: true }];
  const settlements = [settlement('a', 'CAD', '2026-11-02', 20), settlement('b', 'CAD', '2026-11-02', 800)];
  const result = service.summarize('a', 'CAD', 'alice', expenses, settlements, '2026-11-01', '2026-11-30', 'days');
  deepStrictEqual(result?.totals, { currency: 'CAD', spentMinor: 101n, settledMinor: 20n,
    myPaidMinor: 101n, myOwedMinor: 50n, myBalanceMinor: 31n });
  strictEqual(result.chart.totalMinor, 101n);
  deepStrictEqual(result.chart.timeline, [{ period: '2026-11-01', amountMinor: 101n }]);
  deepStrictEqual(result.chart.members.map(row => [row.userId, row.balanceMinor]), [['alice', 31n], ['bob', -31n]]);
});

test('statistics service honors inclusive period boundaries and keeps empty and single-member groups honest', () => {
  const service = new StatisticsService();
  const range = selectedRange('months', '2024-02', '2024-02')!;
  const single: ExpenseLedgerEntry = { groupId: 'solo', currency: 'JPY', date: '2024-02-29', amountMinor: 101,
    payments: [{ userId: 'alice', amountMinor: 101 }], allocations: [{ userId: 'alice', amountMinor: 101 }] };
  const result = service.summarize('solo', 'JPY', 'alice', [single], [], range.start, range.end, 'months');
  strictEqual(result?.totals.myBalanceMinor, 0n);
  strictEqual(result?.chart.totalMinor, 101n);
  deepStrictEqual(result?.chart.timeline, [{ period: '2024-02', amountMinor: 101n }]);
  strictEqual(service.summarize('solo', 'JPY', 'alice', [single], [], '2024-03-01', '2024-03-31', 'months'), undefined);
});

test('statistics service records a repayment-only period without inventing expense categories', () => {
  const result = new StatisticsService().summarize('a', 'CAD', 'outsider', [],
    [settlement('a', 'CAD', '2026-11-18', 25)], '2026-11-18', '2026-11-18', 'days');
  deepStrictEqual(result?.totals, { currency: 'CAD', spentMinor: 0n, settledMinor: 25n,
    myPaidMinor: 0n, myOwedMinor: 0n, myBalanceMinor: 0n });
  deepStrictEqual(result?.chart.categories, []);
});
