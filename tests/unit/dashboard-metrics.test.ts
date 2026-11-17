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
  ];
  deepStrictEqual(dashboardMetrics(expenses, [], 'canada', 'CAD', 'alex', '2026-11'), {
    balanceMinor: -49n, monthlySpentMinor: 101n, monthlyPaidMinor: 101n,
  });
  throws(() => dashboardMetrics(expenses, [], 'canada', 'CAD', 'alex', 'novembre'));
});
