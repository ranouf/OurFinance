import { test } from 'node:test';
import { deepStrictEqual, throws } from 'node:assert';
import { dashboardMetrics } from '../../src/app/features/dashboard/dashboard-metrics';

test('dashboard uses only the selected group, currency and month for its cards', () => {
  const expenses = [
    { groupId: 'canada', currency: 'CAD', date: '2026-11-02', amountMinor: 101,
      payments: [{ userId: 'alex', amountMinor: 101 }], allocations: [{ userId: 'alex', amountMinor: 50 }, { userId: 'camille', amountMinor: 51 }] },
    { groupId: 'canada', currency: 'CAD', date: '2026-10-30', amountMinor: 200,
      payments: [{ userId: 'camille', amountMinor: 200 }], allocations: [{ userId: 'alex', amountMinor: 100 }, { userId: 'camille', amountMinor: 100 }] },
    { groupId: 'japan', currency: 'JPY', date: '2026-11-03', amountMinor: 900,
      payments: [{ userId: 'alex', amountMinor: 900 }], allocations: [{ userId: 'alex', amountMinor: 900 }] },
    { groupId: 'canada', currency: 'CAD', date: '2026-11-04', amountMinor: 999, deleted: true,
      payments: [{ userId: 'alex', amountMinor: 999 }], allocations: [{ userId: 'alex', amountMinor: 999 }] },
  ];
  deepStrictEqual(dashboardMetrics(expenses, [], 'canada', 'CAD', 'alex', '2026-11'), {
    balanceMinor: -49n, groupSpentMinor: 301n, monthlySpentMinor: 101n, monthlyPaidMinor: 101n, settlementTotalMinor: 0n,
    memberBalances: [{ userId: 'alex', balanceMinor: -49n }, { userId: 'camille', balanceMinor: 49n }],
    categories: [{ id: 'other', label: undefined, amountMinor: 301n }],
  });
  throws(() => dashboardMetrics(expenses, [], 'canada', 'CAD', 'alex', 'novembre'));
});

test('dashboard derives repayments, member balances and categories from active group entries', () => {
  const expenses = [{ groupId: 'canada', currency: 'CAD', date: '2026-11-02', amountMinor: 101,
    categoryId: 'groceries', categoryLabel: 'Épicerie', payments: [{ userId: 'alex', amountMinor: 101 }],
    allocations: [{ userId: 'alex', amountMinor: 50 }, { userId: 'camille', amountMinor: 51 }] }];
  const settlements = [
    { groupId: 'canada', currency: 'CAD', date: '2026-11-03', fromUserId: 'camille', toUserId: 'alex', amountMinor: 20 },
    { groupId: 'japan', currency: 'JPY', date: '2026-11-03', fromUserId: 'camille', toUserId: 'alex', amountMinor: 999 },
  ];
  deepStrictEqual(dashboardMetrics(expenses, settlements, 'canada', 'CAD', 'alex', '2026-11'), {
    balanceMinor: 31n, groupSpentMinor: 101n, monthlySpentMinor: 101n, monthlyPaidMinor: 101n,
    settlementTotalMinor: 20n,
    memberBalances: [{ userId: 'alex', balanceMinor: 31n }, { userId: 'camille', balanceMinor: -31n }],
    categories: [{ id: 'groceries', label: 'Épicerie', amountMinor: 101n }],
  });
});
